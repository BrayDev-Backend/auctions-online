import http from "node:http";
import type { AddressInfo } from "node:net";
import { io as connect, type Socket } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/application/app";
import { HmacWebhookSignatureVerifier } from "../../src/infrastructure/security/hmac-webhook-signature.verifier";
import { SocketBroadcasterAdapter } from "../../src/infrastructure/websockets/socket-broadcaster.adapter";
import { AuctionSocketServer, createSocketServer } from "../../src/infrastructure/websockets/socket.server";
import { buildTestContext, HOUR_MS, TestContext, WEBHOOK_SECRET } from "../helpers/context";

/**
 * End-to-end through the real HTTP stack (Express + Socket.io on one server),
 * with in-memory persistence. Only the clock is fake, so closure can be triggered.
 */

interface ApiResult {
  status: number;
  // The envelope is checked by the assertions themselves; JSON.parse is unknown-typed on purpose.
  body: { ok: boolean; data?: any; error?: { code: string; message: string } }; // eslint-disable-line @typescript-eslint/no-explicit-any
}

let ctx: TestContext;
let httpServer: http.Server;
let io: AuctionSocketServer;
let baseUrl: string;

const request = async (
  method: string,
  path: string,
  options: { body?: unknown; token?: string; rawBody?: string; headers?: Record<string, string> } = {}
): Promise<ApiResult> => {
  const payload = options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body));
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...options.headers,
    },
    body: payload,
  });
  return { status: response.status, body: JSON.parse(await response.text()) };
};

const signed = (body: unknown): { rawBody: string; headers: Record<string, string> } => {
  const rawBody = JSON.stringify(body);
  return {
    rawBody,
    headers: { "X-Signature": HmacWebhookSignatureVerifier.sign(WEBHOOK_SECRET, Buffer.from(rawBody)) },
  };
};

const register = async (name: string): Promise<{ token: string; id: string }> => {
  const result = await request("POST", "/auth/register", {
    body: { name, email: `${name.toLowerCase()}@example.com`, password: "Password123!" },
  });
  expect(result.status).toBe(201);
  return { token: result.body.data.token as string, id: result.body.data.user.id as string };
};

const closingIn = (hours: number): string => new Date(ctx.clock.now().getTime() + hours * HOUR_MS).toISOString();

const waitFor = async (condition: () => boolean, timeoutMs = 2000): Promise<void> => {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("Timed out waiting for a socket event");
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

beforeAll(async () => {
  httpServer = http.createServer();
  let app: http.RequestListener | undefined;
  httpServer.removeAllListeners("request");

  // Same wiring trick as server.ts (see the comment there).
  httpServer.on("request", (req, res) => (app ? app(req, res) : res.end()));
  const tokenHolder = buildTestContext(); // only to reuse its tokenService
  io = createSocketServer(httpServer, { corsOrigin: "*", tokenService: tokenHolder.tokenService });

  ctx = buildTestContext({ eventPublisher: new SocketBroadcasterAdapter(io) });
  app = createApp({ ...ctx, tokenService: ctx.tokenService, corsOrigin: "*" });

  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  baseUrl = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await io.close();
});

describe("REST: authentication", () => {
  it("registers, logs in and reads the own profile with the JWT", async () => {
    const ana = await register("Ana");

    const login = await request("POST", "/auth/login", { body: { email: "ana@example.com", password: "Password123!" } });
    expect(login.status).toBe(200);

    const me = await request("GET", "/users/me", { token: ana.token });
    expect(me.status).toBe(200);
    expect(me.body.data).toMatchObject({ id: ana.id, name: "Ana", email: "ana@example.com" });
    expect(JSON.stringify(me.body)).not.toContain("password");
  });

  it("answers 401 without a token or with an invalid one", async () => {
    expect((await request("GET", "/users/me")).status).toBe(401);
    expect((await request("GET", "/users/me", { token: "garbage" })).body.error?.code).toBe("INVALID_TOKEN");
  });

  it("answers 409 for a duplicate email and 400 for invalid input", async () => {
    await register("Dup");
    const duplicate = await request("POST", "/auth/register", {
      body: { name: "Dup", email: "DUP@example.com", password: "Password123!" },
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error?.code).toBe("EMAIL_ALREADY_IN_USE");

    const invalid = await request("POST", "/auth/register", { body: { name: "X", email: "a@b.co", password: "short" } });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error?.code).toBe("VALIDATION_ERROR");
  });

  it("answers 401 with the same error for wrong password and unknown email", async () => {
    await register("Cris");
    const wrong = await request("POST", "/auth/login", { body: { email: "cris@example.com", password: "wrong-password" } });
    const unknown = await request("POST", "/auth/login", { body: { email: "ghost@example.com", password: "wrong-password" } });
    expect(wrong.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
  });
});

describe("REST: standard error format (RNF-12, RNF-13)", () => {
  it("unknown route -> 404 in the standard envelope", async () => {
    const result = await request("GET", "/nothing-here");
    expect(result.status).toBe(404);
    expect(result.body).toEqual({
      ok: false,
      error: { code: "ROUTE_NOT_FOUND", message: expect.stringContaining("/api/v1/nothing-here") },
    });
  });

  it("malformed JSON -> 400 INVALID_JSON", async () => {
    const result = await request("POST", "/auth/login", { rawBody: "{not json" });
    expect(result.status).toBe(400);
    expect(result.body.error?.code).toBe("INVALID_JSON");
  });

  it("health check", async () => {
    expect((await request("GET", "/health")).body).toEqual({ ok: true, data: { status: "up" } });
  });
});

describe("REST + WebSockets: the auction flow", () => {
  it("runs a full auction: create, bid, real-time events, public history, closure, payment", async () => {
    const seller = await register("Sofia");
    const ana = await register("Anabel");
    const ben = await register("Benito");

    // Sockets: Anabel is authenticated (gets personal alerts), a guest only watches.
    const anaSocket: Socket = connect(baseUrl, { auth: { token: ana.token } });
    const guestSocket: Socket = connect(baseUrl);
    const anaEvents: Array<{ name: string; payload: Record<string, unknown> }> = [];
    const guestEvents: Array<{ name: string; payload: Record<string, unknown> }> = [];
    for (const name of ["bid:placed", "bid:outbid", "auction:closed"]) {
      anaSocket.on(name, (payload: Record<string, unknown>) => anaEvents.push({ name, payload }));
      guestSocket.on(name, (payload: Record<string, unknown>) => guestEvents.push({ name, payload }));
    }
    await Promise.all([
      new Promise<void>((resolve) => anaSocket.on("connect", () => resolve())),
      new Promise<void>((resolve) => guestSocket.on("connect", () => resolve())),
    ]);

    try {
      // --- create (seller comes from the token, not from the body)
      const created = await request("POST", "/auctions", {
        token: seller.token,
        body: {
          item_name: "Guitar",
          description: "Acoustic",
          category: "Music",
          base_price: 200_000,
          min_increment: 10_000,
          closing_date: closingIn(2),
          seller_id: "spoofed-id", // ignored
        },
      });
      expect(created.status).toBe(201);
      expect(created.body.data).toMatchObject({ seller_id: seller.id, status: "OPEN", current_highest_bid: null });
      const auctionId = created.body.data.id as string;

      await new Promise<void>((resolve) => anaSocket.emit("auction:join", auctionId, () => resolve()));
      await new Promise<void>((resolve) => guestSocket.emit("auction:join", auctionId, () => resolve()));

      // --- rule violations answer 400 with their specific code
      const selfBid = await request("POST", `/auctions/${auctionId}/bids`, { token: seller.token, body: { amount: 200_000 } });
      expect(selfBid).toMatchObject({ status: 400, body: { error: { code: "SELF_BID_NOT_ALLOWED" } } });
      const low = await request("POST", `/auctions/${auctionId}/bids`, { token: ana.token, body: { amount: 1 } });
      expect(low.body.error?.code).toBe("BID_BELOW_BASE_PRICE");
      expect((await request("POST", `/auctions/${auctionId}/bids`, { body: { amount: 1 } })).status).toBe(401);
      expect((await request("POST", `/auctions/${auctionId}/bids`, { token: ana.token, body: { amount: "x" } })).status).toBe(400);

      // --- accepted bids
      const first = await request("POST", `/auctions/${auctionId}/bids`, { token: ana.token, body: { amount: 200_000 } });
      expect(first.status).toBe(201);
      expect(first.body.data.current_highest_bid).toBe(200_000);
      expect((await request("POST", `/auctions/${auctionId}/bids`, { token: ana.token, body: { amount: 300_000 } })).body.error?.code).toBe(
        "SELF_OUTBID_NOT_ALLOWED"
      );
      expect((await request("POST", `/auctions/${auctionId}/bids`, { token: ben.token, body: { amount: 205_000 } })).body.error?.code).toBe(
        "BID_INCREMENT_TOO_LOW"
      );
      expect((await request("POST", `/auctions/${auctionId}/bids`, { token: ben.token, body: { amount: 210_000 } })).status).toBe(201);

      // --- RN-04: with bids it can no longer be cancelled
      const cancel = await request("PATCH", `/auctions/${auctionId}/cancel`, { token: seller.token });
      expect(cancel.body.error?.code).toBe("AUCTION_CANNOT_BE_CANCELED");

      // --- WebSocket events
      await waitFor(() => guestEvents.length >= 2 && anaEvents.some((event) => event.name === "bid:outbid"));
      expect(guestEvents.map((event) => event.name)).toEqual(["bid:placed", "bid:placed"]);
      expect(guestEvents[1]?.payload).toMatchObject({ auction_id: auctionId, bidder_id: ben.id, amount: 210_000 });
      const outbid = anaEvents.find((event) => event.name === "bid:outbid");
      expect(outbid?.payload).toMatchObject({ auction_id: auctionId, previous_amount: 200_000, new_amount: 210_000 });
      expect(guestEvents.some((event) => event.name === "bid:outbid")).toBe(false); // personal alert: guests never get it

      // --- RN-23: public history shows ids and amounts, never contact info
      const detail = await request("GET", `/auctions/${auctionId}`); // no token
      expect(detail.status).toBe(200);
      expect(detail.body.data.bids).toHaveLength(2);
      expect(Object.keys(detail.body.data.bids[0]).sort()).toEqual(["amount", "auction_id", "bidder_id", "created_at", "id"]);
      expect(JSON.stringify(detail.body)).not.toContain("@example.com");

      // --- lazy closure: time passes, the next read awards the auction
      ctx.clock.advance(3 * HOUR_MS);
      const closed = await request("GET", `/auctions/${auctionId}`);
      expect(closed.body.data).toMatchObject({ status: "CLOSED", winner_id: ben.id, current_highest_bid: 210_000 });
      await waitFor(() => guestEvents.some((event) => event.name === "auction:closed"));
      expect(guestEvents.find((event) => event.name === "auction:closed")?.payload).toMatchObject({
        auction_id: auctionId,
        status: "CLOSED",
        winner_id: ben.id,
        winning_amount: 210_000,
      });
      expect(guestEvents.filter((event) => event.name === "auction:closed")).toHaveLength(1); // RN-16
      expect((await request("POST", `/auctions/${auctionId}/bids`, { token: ana.token, body: { amount: 999_999 } })).body.error?.code).toBe(
        "AUCTION_NOT_OPEN"
      );

      // --- orders are private to winner and seller
      const orders = await request("GET", "/orders", { token: ben.token });
      expect(orders.body.data).toHaveLength(1);
      const order = orders.body.data[0];
      expect(order).toMatchObject({ auction_id: auctionId, winner_id: ben.id, amount: 210_000, status: "PENDING" });
      expect(new Date(order.expires_at).getTime() - new Date(closed.body.data.closing_date).getTime()).toBe(48 * HOUR_MS);
      expect((await request("GET", `/orders/${order.id}`, { token: seller.token })).status).toBe(200);
      expect((await request("GET", `/orders/${order.id}`, { token: ana.token })).status).toBe(403);
      expect((await request("GET", `/orders/${order.id}`)).status).toBe(401);

      // --- webhook (RN-17, RN-18, RN-19)
      const notification = { event_id: "evt-100", order_id: order.id, amount: 210_000, status: "SUCCESS" };
      const unsigned = await request("POST", "/webhooks/payments", { body: notification });
      expect(unsigned).toMatchObject({ status: 401, body: { error: { code: "INVALID_WEBHOOK_SIGNATURE" } } });
      const forged = await request("POST", "/webhooks/payments", {
        rawBody: JSON.stringify(notification),
        headers: { "X-Signature": "sha256=" + "0".repeat(64) },
      });
      expect(forged.status).toBe(401);
      expect((await request("GET", `/orders/${order.id}`, { token: ben.token })).body.data.status).toBe("PENDING");

      const pay = await request("POST", "/webhooks/payments", signed(notification));
      expect(pay).toMatchObject({ status: 200, body: { ok: true, data: { processed: true, order_id: order.id, order_status: "PAID" } } });
      const replay = await request("POST", "/webhooks/payments", signed(notification));
      expect(replay).toEqual(pay); // identical answer
      expect((await request("GET", `/orders/${order.id}`, { token: ben.token })).body.data.status).toBe("PAID");

      const mismatch = await request("POST", "/webhooks/payments", signed({ ...notification, event_id: "evt-101", amount: 1 }));
      expect(mismatch.status).toBe(422);
      const badPayload = await request("POST", "/webhooks/payments", signed({ event_id: "evt-102" }));
      expect(badPayload.status).toBe(400);
    } finally {
      anaSocket.close();
      guestSocket.close();
    }
  });

  it("the seller can cancel an auction that has no bids", async () => {
    const seller = await register("Sara");
    const created = await request("POST", "/auctions", {
      token: seller.token,
      body: { item_name: "Chair", category: "Home", base_price: 50_000, min_increment: 1_000, closing_date: closingIn(5) },
    });
    const id = created.body.data.id as string;

    const other = await register("Omar");
    expect((await request("PATCH", `/auctions/${id}/cancel`, { token: other.token })).status).toBe(403);
    const cancelled = await request("PATCH", `/auctions/${id}/cancel`, { token: seller.token });
    expect(cancelled.body.data.status).toBe("CANCELLED");
  });

  it("validates the auction format and the business rules separately", async () => {
    const seller = await register("Vera");
    const create = (overrides: Record<string, unknown>) =>
      request("POST", "/auctions", {
        token: seller.token,
        body: { item_name: "Lamp", category: "Home", base_price: 10_000, min_increment: 500, closing_date: closingIn(3), ...overrides },
      });

    expect((await create({ closing_date: "tomorrow" })).body.error?.code).toBe("VALIDATION_ERROR"); // format
    expect((await create({ base_price: 0 })).body.error?.code).toBe("INVALID_AUCTION_DATA"); // RN-01
    expect((await create({ base_price: 10.5 })).body.error?.code).toBe("INVALID_MONEY"); // RN-21
    expect((await create({ closing_date: closingIn(-1) })).body.error?.code).toBe("INVALID_CLOSING_DATE"); // RN-02
    expect((await create({ closing_date: closingIn(0.5) })).body.error?.code).toBe("INVALID_AUCTION_DURATION"); // RN-03
    expect((await create({ closing_date: closingIn(24 * 31) })).body.error?.code).toBe("INVALID_AUCTION_DURATION"); // RN-03
  });

  it("lists auctions publicly with filters", async () => {
    const seller = await register("Lola");
    await request("POST", "/auctions", {
      token: seller.token,
      body: { item_name: "Vase", category: "Decor", base_price: 10_000, min_increment: 500, closing_date: closingIn(4) },
    });

    const filtered = await request("GET", "/auctions?category=Decor&status=OPEN");
    expect(filtered.status).toBe(200);
    expect(filtered.body.data.length).toBeGreaterThanOrEqual(1);
    expect(filtered.body.data.every((auction: { category: string }) => auction.category === "Decor")).toBe(true);
    expect((await request("GET", "/auctions?status=NOPE")).status).toBe(400);
  });
});

describe("WebSockets: connection rules", () => {
  it("rejects a handshake with an invalid token", async () => {
    const socket = connect(baseUrl, { auth: { token: "garbage" }, reconnection: false });
    const error = await new Promise<Error>((resolve) => socket.on("connect_error", resolve));
    expect(error.message).toBe("INVALID_TOKEN");
    socket.close();
  });

  it("validates the auction id when joining a room", async () => {
    const socket = connect(baseUrl);
    await new Promise<void>((resolve) => socket.on("connect", () => resolve()));
    const bad = await new Promise<{ ok: boolean; error?: string }>((resolve) => socket.emit("auction:join", 42, resolve));
    expect(bad).toEqual({ ok: false, error: "INVALID_AUCTION_ID" });
    socket.close();
  });
});
