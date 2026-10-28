import http from "node:http";
import { createApp } from "./src/application/app";
import { env } from "./src/config/env";
import { createServices } from "./src/config/container";
import { createInMemoryPersistence, createPostgresPersistence, IPersistence } from "./src/infrastructure/persistence/persistence";
import { logger } from "./src/infrastructure/logger/console.logger";
import { BcryptPasswordHasher } from "./src/infrastructure/security/bcrypt-password-hasher";
import { HmacWebhookSignatureVerifier } from "./src/infrastructure/security/hmac-webhook-signature.verifier";
import { JwtTokenService } from "./src/infrastructure/security/jwt-token.service";
import { SystemClock, UuidGenerator } from "./src/infrastructure/system/system.adapters";
import { LoggingEventPublisher } from "./src/infrastructure/websockets/logging-event-publisher";
import { SocketBroadcasterAdapter } from "./src/infrastructure/websockets/socket-broadcaster.adapter";
import { createSocketServer } from "./src/infrastructure/websockets/socket.server";

/** Chooses the persistence adapter (RNF-06): PERSISTENCE=postgres | memory. */
const createPersistence = async (): Promise<IPersistence> => {
  if (env.PERSISTENCE === "memory") {
    logger.warn("Using IN-MEMORY persistence: data is lost when the process stops.");
    return createInMemoryPersistence();
  }
  if (env.DATABASE_URL === undefined) {
    throw new Error("DATABASE_URL is required when PERSISTENCE=postgres");
  }
  return createPostgresPersistence(env.DATABASE_URL);
};

const main = async (): Promise<void> => {
  const persistence = await createPersistence();
  const tokenService = new JwtTokenService(env.JWT_SECRET, env.JWT_EXPIRES_IN);

  // One HTTP server shared by Express (REST) and Socket.io (WebSockets).
  // The Express app needs the services, and the services need Socket.io (to publish
  // events), while Socket.io needs the HTTP server first. A small delegating handler
  // breaks that cycle. Socket.io wraps this listener: it answers /socket.io/ requests
  // itself and forwards every other request to it.
  let expressApp: http.RequestListener | undefined;
  const httpServer = http.createServer((req, res) => {
    if (expressApp === undefined) {
      res.statusCode = 503;
      res.end("Server starting");
      return;
    }
    expressApp(req, res);
  });
  const io = createSocketServer(httpServer, { corsOrigin: env.CORS_ORIGIN, tokenService });

  const services = createServices({
    persistence,
    tokenService,
    passwordHasher: new BcryptPasswordHasher(env.BCRYPT_SALT_ROUNDS),
    signatureVerifier: new HmacWebhookSignatureVerifier(env.WEBHOOK_SECRET),
    // Domain events -> Socket.io, logged to the console, and never able to break a request.
    eventPublisher: new LoggingEventPublisher(new SocketBroadcasterAdapter(io), logger),
    clock: new SystemClock(),
    idGenerator: new UuidGenerator(),
  });

  expressApp = createApp({ ...services, tokenService, corsOrigin: env.CORS_ORIGIN });

  httpServer.listen(env.PORT, () => {
    logger.info(`SERVER RUNNING ON PORT ${env.PORT} (persistence: ${env.PERSISTENCE}, env: ${env.NODE_ENV})`);
  });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info(`${signal} received: shutting down...`);
    await io.close(); // also closes the HTTP server
    await persistence.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
};

main().catch((error: unknown) => {
  logger.error("The server could not start", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => logger.error("Unhandled promise rejection", reason));
