# Auctions Online

A REST API and real-time event service for an online auction platform. Built with
Node.js, TypeScript, Express 5, PostgreSQL, Prisma, and Socket.IO.

The service supports user registration and JWT authentication, auction creation
and discovery, bidding, lazy auction settlement, winner payment orders, signed
payment notifications, and real-time auction updates. PostgreSQL is the default
persistence adapter; an in-memory adapter is available for local experimentation
and tests.

> **Development status:** This repository contains a working backend and
> automated unit/integration tests. It does not include a frontend, a real payment
> gateway integration, a production deployment configuration, or an OpenAPI
> specification. The payment simulator is for local development only.

## Contents

- [Features](#features)
- [Technology and architecture](#technology-and-architecture)
- [Requirements](#requirements)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Commands](#commands)
- [REST API](#rest-api)
- [Real-time API](#real-time-api)
- [Auction and payment lifecycle](#auction-and-payment-lifecycle)
- [Data model](#data-model)
- [Errors](#errors)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Security and operational notes](#security-and-operational-notes)

## Features

- Public auction listing and detail endpoints with category, status, and seller
  filters.
- Authenticated user registration and login using bcrypt password hashes and
  signed JWTs.
- Authenticated auction creation, cancellation, and bidding.
- Domain-enforced auction durations, bid increments, seller restrictions, and
  bid rejection audit records.
- Thread-safe per-auction coordination for bids, closing, and order/payment
  settlement.
- Lazy auction closing and order expiration: no scheduler or background worker
  is required.
- Payment orders for auction winners and HMAC-SHA256 authenticated payment
  notifications with event-id idempotency.
- Socket.IO rooms for public auction events and private outbid notifications.
- PostgreSQL/Prisma persistence and a replaceable in-memory persistence adapter.
- Centralized JSON validation and error responses.

## Technology and architecture

The code is organized around a ports-and-adapters / clean architecture
separation:

| Layer | Responsibility |
| --- | --- |
| `src/domain` | Auction, bid, user, and order rules; domain errors; services; ports; and value objects. This layer has no Express or Prisma dependency. |
| `src/application` | Express app, routes, controllers, Zod input schemas, middleware, and JSON presenters. |
| `src/infrastructure` | Prisma and in-memory repositories, password/JWT/HMAC adapters, clock and ID providers, logging, and Socket.IO adapters. |
| `src/config` | Environment validation and the composition root that connects services to ports and adapters. |
| `prisma` | PostgreSQL schema, migrations, and development seed data. |
| `tests` | Domain tests and HTTP API integration tests. |

The server creates one HTTP server shared by Express and Socket.IO. Services
receive repository and infrastructure interfaces rather than concrete adapters.
Select the persistence implementation using `PERSISTENCE`; the domain and
application use cases are the same with either adapter.

## Requirements

- Node.js and npm versions supported by the installed Prisma 7 toolchain.
- Docker with Docker Compose for the PostgreSQL setup (or a compatible
  PostgreSQL instance).

## Getting started

### 1. Install dependencies and configure the environment

```bash
npm install
cp .env.example .env
```

Edit `.env` before starting the service:

- Set `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and `DB_PORT` for the local database.
- Set `DATABASE_URL` to a connection URL using matching database credentials.
- Replace `JWT_SECRET` and `WEBHOOK_SECRET` with private random values of at
  least 16 characters each.

For example, the URL format is:

```text
postgresql://<DB_USER>:<DB_PASSWORD>@localhost:<DB_PORT>/<DB_NAME>?schema=public
```

Do not use the example secrets in a deployed environment or commit `.env`.

### 2. Start PostgreSQL and apply migrations

```bash
npm run db:up
npm run db:migrate
```

The Compose file starts PostgreSQL 17 and persists data in the
`auctions_pgdata` Docker volume. It reads database settings from `.env`.

### 3. (Optional) Load the development seed

```bash
npm run db:seed
```

The seed inserts the sample users, auctions, and bids from
`prisma/seed-data/auctions.mockdata.ts`. It skips rows that already exist and
shifts sample timestamps relative to the current time. Every seeded user has
the development-only password `Password123!`; sample email addresses follow
`usuario001@example.com` through `usuario020@example.com` (only IDs present in
the dataset are created). Do not use this seed or its shared password with
production data.

### 4. Run the server

```bash
npm run dev
```

The API listens on `http://localhost:3000` by default. Confirm it is ready:

```bash
curl http://localhost:3000/api/v1/health
```

Expected response:

```json
{"ok":true,"data":{"status":"up"}}
```

### In-memory mode

To run without PostgreSQL, set `PERSISTENCE=memory` in `.env` and start the
server. This adapter starts with empty data and loses all changes when the
process exits. The application still requires valid `JWT_SECRET` and
`WEBHOOK_SECRET` values.

## Configuration

All settings are parsed and validated when the process starts. Invalid
configuration causes a startup error. The canonical template is
[.env.example](./.env.example).

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `NODE_ENV` | No | `development` | Environment label written to startup logs. |
| `PORT` | No | `3000` | Positive integer HTTP port. |
| `PERSISTENCE` | No | `postgres` | `postgres` or `memory`. |
| `DATABASE_URL` | With PostgreSQL | — | PostgreSQL connection URL. |
| `JWT_SECRET` | Yes | — | Secret used to sign and verify JWTs; at least 16 characters. |
| `JWT_EXPIRES_IN` | No | `1h` | JWT lifetime, e.g. `3600`, `15m`, `1h`, or `7d`. |
| `BCRYPT_SALT_ROUNDS` | No | `10` | bcrypt cost factor from 4 through 15. |
| `CORS_ORIGIN` | No | `*` | Allowed origin or comma-separated origins for REST and Socket.IO. |
| `WEBHOOK_SECRET` | Yes | — | Shared HMAC secret; at least 16 characters. |
| `DB_USER` | For Compose | — | PostgreSQL user used by the Compose container. |
| `DB_PASSWORD` | For Compose | — | PostgreSQL password used by the Compose container. |
| `DB_NAME` | For Compose | — | PostgreSQL database name. |
| `DB_HOST` | Informational | — | Included in the example URL; Compose maps the DB to the host. |
| `DB_PORT` | For Compose | `5432` | Host port mapped to PostgreSQL's container port `5432`. |

`DATABASE_URL` is used by the application and Prisma CLI. The `DB_*` values are
used by Docker Compose and must agree with the URL. `DB_HOST` is not read by
Compose; use the correct hostname in `DATABASE_URL` for your environment.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run `server.ts` with Nodemon/tsx and restart on source changes. |
| `npm run build` | Generate the Prisma client and compile TypeScript into `dist/`. |
| `npm start` | Run the compiled server at `dist/server.js`. |
| `npm run typecheck` | Type-check source and test TypeScript configuration. |
| `npm test` | Run the Vitest suite once. |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run db:up` | Start PostgreSQL in the background. |
| `npm run db:down` | Stop the Compose services; the named volume remains. |
| `npm run db:migrate` | Apply/create development migrations with Prisma. |
| `npm run db:deploy` | Apply committed migrations, intended for deployment workflows. |
| `npm run db:seed` | Load development fixture data into PostgreSQL. |
| `npm run db:reset` | Reset the database and rerun migrations/seed. **Destructive:** existing database data is removed. |
| `npm run webhook:simulate -- ...` | Send a signed development payment notification (see [Payment simulator](#payment-simulator)). |

Production build and startup:

```bash
npm ci
npm run db:deploy
npm run build
npm start
```

Set production environment variables through the deployment platform's secret
management; do not rely on a checked-in or image-baked `.env` file.

## REST API

All REST endpoints are under `/api/v1`. Unless noted otherwise, successful
responses use the envelope:

```json
{"ok":true,"data":{}}
```

JSON property names use `snake_case`. Dates are ISO 8601 strings and monetary
amounts are integer Colombian pesos (COP), represented as JSON numbers within
JavaScript's safe integer range. There is no pagination currently.

### Endpoint overview

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | Liveness response. |
| `GET` | `/auctions` | Public | List auctions. Optional `category`, `status`, and `seller_id` filters. |
| `GET` | `/auctions/:auction_id` | Public | Get an auction and its public bid history. |
| `POST` | `/auctions` | Bearer JWT | Publish an auction as the authenticated user. |
| `PATCH` | `/auctions/:auction_id/cancel` | Bearer JWT | Cancel an eligible auction as its seller. |
| `POST` | `/auctions/:auction_id/bids` | Bearer JWT | Place a bid as the authenticated user. |
| `POST` | `/auth/register` | Public | Register and receive a JWT. |
| `POST` | `/auth/login` | Public | Authenticate and receive a JWT. |
| `GET` | `/users/me` | Bearer JWT | Get the authenticated user's profile. |
| `GET` | `/orders` | Bearer JWT | List payment orders for auctions the user won. |
| `GET` | `/orders/:order_id` | Bearer JWT | Get an order as its winner or the auction seller. |
| `POST` | `/webhooks/payments` | HMAC signature | Process a payment gateway notification. |

Protected endpoints require:

```http
Authorization: Bearer <JWT>
```

The API derives seller and bidder identity from the token; clients cannot
specify another user's ID for those operations.

### Authentication

Register:

```http
POST /api/v1/auth/register
Content-Type: application/json
```

```json
{
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "password": "a-long-password"
}
```

`name` is trimmed and must be 2–100 characters, `email` 3–254 characters, and
`password` 8–72 characters. Successful registration returns `201 Created`:

```json
{
  "ok": true,
  "data": {
    "token": "<jwt>",
    "user": {"id": "<user-id>", "name": "Ada Lovelace", "email": "ada@example.com"}
  }
}
```

`POST /api/v1/auth/login` accepts `email` and `password`, and returns the same
data shape with `200 OK`. Invalid credentials use the same error regardless
of whether the email exists.

### Auctions

`GET /api/v1/auctions` accepts optional query parameters:

| Parameter | Values | Description |
| --- | --- | --- |
| `category` | Non-empty string | Exact category match. |
| `status` | `OPEN`, `CANCELLED`, `CLOSED`, `DESERTED`, `BREACH` | Auction status. |
| `seller_id` | Non-empty string | Seller identifier. |

Example:

```bash
curl "http://localhost:3000/api/v1/auctions?category=Art&status=OPEN"
```

Each auction response contains `id`, `item_name`, `description`, `category`,
`seller_id`, `base_price`, `min_increment`, `current_highest_bid`,
`published_at`, `closing_date`, `status`, `winner_id`, and `bids`. Each public
bid includes its ID, auction ID, bidder ID, amount, and timestamp; bidder email
and other contact information are never included.

Create an auction with `POST /api/v1/auctions`:

```json
{
  "item_name": "Vintage camera",
  "description": "Excellent condition",
  "category": "Collectibles",
  "base_price": 100000,
  "min_increment": 5000,
  "closing_date": "2026-12-01T18:00:00.000Z"
}
```

`description` is optional and defaults to an empty string. The closing date
must be an ISO datetime including a timezone offset. `base_price` and
`min_increment` must be positive integer COP values. An auction must close
between one hour and 30 days after publication. The authenticated user becomes
the seller. Success returns `201 Created` with the auction representation.

`PATCH /api/v1/auctions/:auction_id/cancel` has no body. Only its seller can
cancel it, and only while it is open and has no bids. Success returns the
updated auction with status `CANCELLED`.

### Bids

`POST /api/v1/auctions/:auction_id/bids` accepts:

```json
{"amount": 105000}
```

The first bid must be at least the base price. Each later bid must be at least
the current highest bid plus the minimum increment. Sellers cannot bid on their
own auctions, and the current highest bidder cannot bid again. Bids are accepted
only while the auction is open and before its closing time. Amounts must be
integer, non-negative COP values; domain-invalid bid amounts and rule violations
are rejected, and rejected bids are recorded for audit.

Success returns `201 Created`:

```json
{
  "ok": true,
  "data": {
    "bid": {
      "id": "<bid-id>",
      "auction_id": "<auction-id>",
      "bidder_id": "<user-id>",
      "amount": 105000,
      "created_at": "2026-11-06T12:00:00.000Z"
    },
    "current_highest_bid": 105000
  }
}
```

`current_highest_bid` is `null` only if no bid exists (a successful bid always
sets it).

### User profile and orders

`GET /api/v1/users/me` returns the authenticated user's `id`, `name`, `email`,
and `created_at`.

`GET /api/v1/orders` returns the authenticated user's payment orders as a
`data` array. `GET /api/v1/orders/:order_id` is visible only to the order's
winner or the related auction's seller. An order includes `id`, `auction_id`,
`winner_id`, `amount`, `status`, `created_at`, `expires_at`, and `paid_at`.

Order statuses are `PENDING`, `PAID`, and `EXPIRED`.

### Payment webhook

`POST /api/v1/webhooks/payments` expects a JSON body:

```json
{
  "event_id": "gateway-event-123",
  "order_id": "<order-id>",
  "amount": 105000,
  "status": "SUCCESS"
}
```

`status` is `SUCCESS` or `FAILED`. The request must include an `X-Signature`
header containing an HMAC-SHA256 signature of the **exact raw request body**:

```text
X-Signature: sha256=<hex-digest>
```

The `sha256=` prefix is optional. The server verifies the signature before it
parses or trusts the body. The payment amount must equal the order amount; only
a valid `SUCCESS` event changes an order to `PAID`. `FAILED` events are
recorded, but leave a pending order payable. Repeating an event ID for the same
order replays the original result; reusing it for another order is rejected.

Successful notifications return `200 OK`, for example:

```json
{
  "ok": true,
  "data": {
    "processed": true,
    "order_id": "<order-id>",
    "order_status": "PAID"
  }
}
```

Use the simulator for local testing rather than calculating the signature by
hand (see [Payment simulator](#payment-simulator)).

## Real-time API

Socket.IO is served on the same origin and port as the REST API. Clients may
connect anonymously to watch public auctions, or provide a JWT to receive
personal notifications:

```js
import { io } from "socket.io-client";

const socket = io("http://localhost:3000", {
  auth: { token: "<jwt>" }
});
```

Without a token the client can join public auction rooms, but will not receive
private outbid alerts. Invalid tokens fail the socket connection. On connect,
an authenticated user is automatically added to their private user room.

Client-to-server events:

| Event | Payload | Acknowledgement |
| --- | --- | --- |
| `auction:join` | Auction ID string | `{ "ok": true, "room": "auction:<id>" }` |
| `auction:leave` | Auction ID string | `{ "ok": true, "room": "auction:<id>" }` |

IDs must be non-empty strings of at most 100 characters. Invalid IDs receive
`{ "ok": false, "error": "INVALID_AUCTION_ID" }`.

Server-to-client events:

| Event | Recipients | Payload fields |
| --- | --- | --- |
| `bid:placed` | Clients in the auction room | `auction_id`, `bid_id`, `bidder_id`, `amount`, `placed_at` |
| `bid:outbid` | The previous highest bidder only | `auction_id`, `previous_amount`, `new_amount` |
| `auction:closed` | Auction room and, when present, the winner | `auction_id`, `status`, `winner_id`, `winning_amount`, `order_id`, `closed_at` |

Socket notifications are best-effort: publication failures are logged and do
not fail an otherwise completed business operation.

## Auction and payment lifecycle

1. A user publishes an auction that closes one hour to 30 days in the future.
2. Authenticated users bid subject to the base-price, minimum-increment,
   seller, and current-highest-bid rules. Per-auction locking and database
   constraints protect concurrent bids.
3. There is no scheduled job. Auction lifecycle evaluation happens lazily when
   an auction is read, listed, bid on, or when its order is accessed.
4. Once due, an auction with a bid becomes `CLOSED`, records the highest bidder
   as winner, and gets one `PENDING` payment order for the winning amount. An
   auction without bids becomes `DESERTED`.
5. The winner's payment deadline is 48 hours after the auction's scheduled
   closing time, not the time when the service first notices the auction ended.
6. A valid signed payment `SUCCESS` webhook marks the order `PAID`. If the
   payment deadline has passed, the order becomes `EXPIRED` and the auction
   becomes `BREACH` during a later lazy settlement.

The application-wide per-auction mutex coordinates in-process use cases. For
multi-instance deployments, use a distributed coordination strategy or database
concurrency guarantees; an in-memory mutex is not shared across server
processes.

## Data model

Prisma maps the following domain records to PostgreSQL:

| Model | Purpose |
| --- | --- |
| `User` | Identity, unique email, password hash, and seller/bidder/winner relations. |
| `Auction` | Item details, seller, COP prices, lifecycle dates/status, and optional winner. |
| `Bid` | Accepted bids; `(auction_id, amount)` is unique. |
| `RejectedBidAttempt` | Audit record for each rejected bid, with a reason code and message. |
| `PaymentOrder` | One payment order per awarded auction, with amount, status, and deadline. |
| `ProcessedWebhookEvent` | Idempotency record keyed by gateway `event_id`. |

Money is stored as PostgreSQL `BigInt` and exposed as a safe integer JSON
number. Passwords are stored only as bcrypt hashes. Auction statuses are
`OPEN`, `CANCELLED`, `CLOSED`, `DESERTED`, and `BREACH`; order statuses are
`PENDING`, `PAID`, and `EXPIRED`.

The generated Prisma client is written to
`src/infrastructure/database/generated/prisma` during `npm install` and
`npm run build`; generated files are intentionally ignored by Git.

## Errors

All handled failures use this JSON shape:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "amount: Invalid input"
  }
}
```

Common HTTP statuses include:

| Status | Meaning | Example codes |
| --- | --- | --- |
| `400` | Invalid request or domain rule violation | `VALIDATION_ERROR`, `INVALID_JSON`, `BID_INCREMENT_TOO_LOW`, `AUCTION_NOT_OPEN` |
| `401` | Missing/invalid credentials or webhook signature | `UNAUTHORIZED`, `INVALID_TOKEN`, `INVALID_CREDENTIALS`, `INVALID_WEBHOOK_SIGNATURE` |
| `403` | Authenticated user lacks access | `NOT_AUCTION_OWNER`, `ORDER_ACCESS_DENIED` |
| `404` | Resource or route not found | `AUCTION_NOT_FOUND`, `ORDER_NOT_FOUND`, `ROUTE_NOT_FOUND` |
| `409` | State or uniqueness conflict | `EMAIL_ALREADY_IN_USE`, `ORDER_EXPIRED`, `WEBHOOK_EVENT_CONFLICT` |
| `422` | Payment amount does not match the order | `PAYMENT_AMOUNT_MISMATCH` |
| `500` | Unexpected server failure | `INTERNAL_SERVER_ERROR` |

Unexpected errors are logged server-side; their details are not returned to the
client.

## Testing

Run the full automated suite and type check:

```bash
npm test
npm run typecheck
```

Vitest tests cover domain entities and services, value objects, webhook
behavior, and HTTP API routes. Tests use the shared service composition with
test dependencies rather than requiring a live PostgreSQL database.

## Project structure

```text
.
├── prisma/
│   ├── migrations/              # Versioned PostgreSQL schema changes
│   ├── seed-data/               # Auction fixture data
│   ├── schema.prisma            # Persistence schema
│   └── seed.ts                  # Development seed loader
├── scripts/
│   └── simulate-payment.ts      # Signed local payment-webhook client
├── src/
│   ├── application/             # HTTP app, controllers, routes, schemas
│   ├── config/                  # Environment and dependency composition
│   ├── domain/                  # Business model and use cases
│   └── infrastructure/          # DB, security, logging, sockets, adapters
├── tests/
│   ├── domain/                  # Domain tests
│   ├── helpers/                 # Shared test setup
│   └── http/                    # API integration tests
├── server.ts                    # Process and HTTP server entry point
├── docker-compose.yml           # Local PostgreSQL service
└── package.json                 # Scripts and dependencies
```

## Security and operational notes

- Treat JWT and webhook secrets as credentials. Provide unique, high-entropy
  values through your deployment secret store; the 16-character validation is
  only a minimum format check, not a strength guarantee.
- The webhook signature covers exact body bytes. Gateways and clients must sign
  the same serialized bytes they send.
- CORS defaults to `*` for development. Configure an explicit origin list for
  deployments that need browser access.
- The in-memory adapter, development seed credentials, payment simulator, and
  process-local auction lock are not production infrastructure substitutes.
- No rate limiter, API documentation endpoint, automated job scheduler, or
  payment gateway client is included.
- Use `npm run db:reset` only when intentionally discarding the local database.

### Payment simulator

With the API running, send a signed payment notification:

```bash
npm run webhook:simulate -- <order_id> <amount>
```

Optional flags:

```bash
npm run webhook:simulate -- <order_id> <amount> --status FAILED
npm run webhook:simulate -- <order_id> <amount> --event-id evt_123
npm run webhook:simulate -- <order_id> <amount> --bad-signature
```

Reuse `--event-id` to exercise idempotent replay. `--bad-signature` demonstrates
signature rejection. The simulator reads `PORT` and `WEBHOOK_SECRET` from `.env`.
