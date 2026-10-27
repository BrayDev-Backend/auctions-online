import type { Server as HttpServer } from "node:http";
import { Server, Socket } from "socket.io";
import { ITokenService } from "../../domain/ports/token-service.port";
import { logger } from "../logger/console.logger";

// ---------- Wire contract (what travels through the socket) ----------

// JSON keys are snake_case, like the REST API.
export interface BidPlacedMessage {
  auction_id: string;
  bid_id: string;
  bidder_id: string;
  amount: number;
  placed_at: string;
}

export interface OutbidMessage {
  auction_id: string;
  previous_amount: number;
  new_amount: number;
}

export interface AuctionClosedMessage {
  auction_id: string;
  status: string;
  winner_id: string | null;
  winning_amount: number | null;
  order_id: string | null;
  closed_at: string;
}

export interface JoinAck {
  ok: boolean;
  room?: string;
  error?: string;
}

/** Events the SERVER sends to clients. */
export interface ServerToClientEvents {
  "bid:placed": (message: BidPlacedMessage) => void;
  "bid:outbid": (message: OutbidMessage) => void;
  "auction:closed": (message: AuctionClosedMessage) => void;
}

/** Events CLIENTS send to the server. */
export interface ClientToServerEvents {
  "auction:join": (auctionId: unknown, ack?: (response: JoinAck) => void) => void;
  "auction:leave": (auctionId: unknown, ack?: (response: JoinAck) => void) => void;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface InterServerEvents {}

export interface SocketData {
  userId: string | null;
}

export type AuctionSocketServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type AuctionSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

// ---------- Rooms ----------

/** Everybody watching an auction (public: bid history is public, RN-23). */
export const auctionRoom = (auctionId: string): string => `auction:${auctionId}`;
/** Private room of one user (outbid alerts are personal). */
export const userRoom = (userId: string): string => `user:${userId}`;

const isValidId = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 100;

export interface ISocketServerOptions {
  corsOrigin: string;
  tokenService: ITokenService;
}

/**
 * Creates the Socket.io server attached to the same HTTP server as Express.
 *
 * Authentication (optional): the client sends its JWT in the handshake:
 *   io("http://localhost:3000", { auth: { token: "<jwt>" } })
 * Anonymous clients can watch auctions; only authenticated ones receive
 * personal outbid alerts.
 */
export const createSocketServer = (httpServer: HttpServer, options: ISocketServerOptions): AuctionSocketServer => {
  const io: AuctionSocketServer = new Server(httpServer, {
    cors: { origin: options.corsOrigin === "*" ? true : options.corsOrigin.split(",") },
  });

  io.use((socket, next) => {
    const auth: unknown = socket.handshake.auth;
    const token = typeof auth === "object" && auth !== null && "token" in auth ? auth.token : undefined;

    if (token === undefined || token === null || token === "") {
      socket.data.userId = null;
      return next();
    }
    if (typeof token !== "string") {
      return next(new Error("INVALID_TOKEN"));
    }
    try {
      socket.data.userId = options.tokenService.verify(token).userId;
      return next();
    } catch {
      return next(new Error("INVALID_TOKEN"));
    }
  });

  io.on("connection", (socket: AuctionSocket) => {
    const { userId } = socket.data;
    if (userId !== null) {
      void socket.join(userRoom(userId));
    }
    logger.info(`Socket connected ${socket.id}${userId ? ` (user ${userId})` : " (anonymous)"}`);

    socket.on("auction:join", (auctionId, ack) => {
      if (!isValidId(auctionId)) {
        ack?.({ ok: false, error: "INVALID_AUCTION_ID" });
        return;
      }
      void socket.join(auctionRoom(auctionId));
      ack?.({ ok: true, room: auctionRoom(auctionId) });
    });

    socket.on("auction:leave", (auctionId, ack) => {
      if (!isValidId(auctionId)) {
        ack?.({ ok: false, error: "INVALID_AUCTION_ID" });
        return;
      }
      void socket.leave(auctionRoom(auctionId));
      ack?.({ ok: true, room: auctionRoom(auctionId) });
    });

    socket.on("disconnect", (reason) => {
      logger.info(`Socket disconnected ${socket.id} (${reason})`);
    });
  });

  return io;
};
