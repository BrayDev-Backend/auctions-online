import { IAuctionClosedEvent, IBidPlacedEvent, IEventPublisherPort, IOutbidEvent } from "../../src/domain/ports/event-publisher.port";
import { IPasswordHasher } from "../../src/domain/ports/password-hasher.port";
import { IClock, IIdGenerator } from "../../src/domain/ports/system.port";
import { createServices } from "../../src/config/container";
import { IPersistence } from "../../src/infrastructure/persistence/persistence";
import { InMemoryAuctionRepository } from "../../src/infrastructure/repositories/in-memory/in-memory-auction.repository";
import { InMemoryOrderRepository } from "../../src/infrastructure/repositories/in-memory/in-memory-order.repository";
import { InMemoryUserRepository } from "../../src/infrastructure/repositories/in-memory/in-memory-user.repository";
import { InMemoryWebhookEventRepository } from "../../src/infrastructure/repositories/in-memory/in-memory-webhook-event.repository";
import { HmacWebhookSignatureVerifier } from "../../src/infrastructure/security/hmac-webhook-signature.verifier";
import { JwtTokenService } from "../../src/infrastructure/security/jwt-token.service";

export const WEBHOOK_SECRET = "test-webhook-secret-123456";
export const JWT_SECRET = "test-jwt-secret-1234567890";

export const HOUR_MS = 60 * 60 * 1000;

/** A clock the test can move forward: this is how lazy closure is tested without waiting. */
export class FakeClock implements IClock {
  constructor(private current: Date) {}

  now(): Date {
    return new Date(this.current.getTime());
  }

  set(date: Date): void {
    this.current = date;
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export class SequentialIdGenerator implements IIdGenerator {
  private counter = 0;

  generate(): string {
    this.counter += 1;
    return `id-${this.counter}`;
  }
}

/** Not a real hash: fast and deterministic, but still proves the plain password is not stored. */
export class FakePasswordHasher implements IPasswordHasher {
  async hash(plainPassword: string): Promise<string> {
    return `hashed(${plainPassword})`;
  }

  async compare(plainPassword: string, passwordHash: string): Promise<boolean> {
    return passwordHash === `hashed(${plainPassword})`;
  }
}

/** Remembers every announced event so tests can assert on them. */
export class RecordingEventPublisher implements IEventPublisherPort {
  readonly bidPlaced: IBidPlacedEvent[] = [];
  readonly outbid: IOutbidEvent[] = [];
  readonly closed: IAuctionClosedEvent[] = [];

  async publishBidPlaced(event: IBidPlacedEvent): Promise<void> {
    this.bidPlaced.push(event);
  }

  async publishOutbid(event: IOutbidEvent): Promise<void> {
    this.outbid.push(event);
  }

  async publishAuctionClosed(event: IAuctionClosedEvent): Promise<void> {
    this.closed.push(event);
  }
}

export const T0 = new Date("2026-01-01T12:00:00.000Z");

/** Real use cases wired to in-memory adapters, a movable clock and a recording publisher. */
export const buildTestContext = (options: { startAt?: Date; eventPublisher?: IEventPublisherPort } = {}) => {
  const auctionRepository = new InMemoryAuctionRepository();
  const orderRepository = new InMemoryOrderRepository();
  const userRepository = new InMemoryUserRepository();
  const webhookEventRepository = new InMemoryWebhookEventRepository();
  const persistence: IPersistence = {
    auctionRepository,
    orderRepository,
    userRepository,
    webhookEventRepository,
    close: async () => undefined,
  };

  const clock = new FakeClock(options.startAt ?? T0);
  const publisher = new RecordingEventPublisher();
  const tokenService = new JwtTokenService(JWT_SECRET, "1h");

  const services = createServices({
    persistence,
    tokenService,
    passwordHasher: new FakePasswordHasher(),
    signatureVerifier: new HmacWebhookSignatureVerifier(WEBHOOK_SECRET),
    eventPublisher: options.eventPublisher ?? publisher,
    clock,
    idGenerator: new SequentialIdGenerator(),
  });

  return {
    ...services,
    auctionRepository,
    orderRepository,
    userRepository,
    webhookEventRepository,
    clock,
    publisher,
    tokenService,
  };
};

export type TestContext = ReturnType<typeof buildTestContext>;

/** Creates an auction closing in `hours` hours from the test clock's "now". */
export const createOpenAuction = async (
  ctx: TestContext,
  overrides: { sellerId?: string; basePrice?: number; minIncrement?: number; hours?: number } = {}
) =>
  ctx.auctionService.createAuction(
    {
      itemName: "Vintage camera",
      description: "Works perfectly",
      category: "Electronics",
      basePrice: overrides.basePrice ?? 100_000,
      minIncrement: overrides.minIncrement ?? 5_000,
      closingDate: new Date(ctx.clock.now().getTime() + (overrides.hours ?? 2) * HOUR_MS),
    },
    overrides.sellerId ?? "seller"
  );
