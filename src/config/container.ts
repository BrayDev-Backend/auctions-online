import { IEventPublisherPort } from "../domain/ports/event-publisher.port";
import { IPasswordHasher } from "../domain/ports/password-hasher.port";
import { IClock, IIdGenerator } from "../domain/ports/system.port";
import { ITokenService } from "../domain/ports/token-service.port";
import { IWebhookSignatureVerifier } from "../domain/ports/webhook-signature.port";
import { KeyedMutex } from "../domain/shared/keyed-mutex";
import { createAuctionService } from "../domain/services/auction.service";
import { createAuctionSettlement } from "../domain/services/auction-settlement.service";
import { createAuthService } from "../domain/services/auth.service";
import { createOrderService } from "../domain/services/order.service";
import { createUserService } from "../domain/services/user.service";
import { createWebhookService } from "../domain/services/webhook.service";
import { IPersistence } from "../infrastructure/persistence/persistence";

/** Every OUTPUT PORT implementation the domain services need. */
export interface IServiceDependencies {
  persistence: IPersistence;
  tokenService: ITokenService;
  passwordHasher: IPasswordHasher;
  signatureVerifier: IWebhookSignatureVerifier;
  eventPublisher: IEventPublisherPort;
  clock: IClock;
  idGenerator: IIdGenerator;
}

/**
 * COMPOSITION ROOT (services). The only place where ports meet adapters.
 * It never reads process.env, so tests can wire fakes (in-memory repositories,
 * fixed clock, recording publisher) and run the exact same use cases.
 */
export const createServices = (deps: IServiceDependencies) => {
  const { persistence, tokenService, passwordHasher, signatureVerifier, eventPublisher, clock, idGenerator } = deps;
  const { userRepository, auctionRepository, orderRepository, webhookEventRepository } = persistence;

  // One lock shared by EVERY use case that touches an auction (bids, closure, orders, webhook).
  const auctionLock = new KeyedMutex();

  const settlement = createAuctionSettlement({ auctionRepository, orderRepository, eventPublisher, idGenerator });

  return {
    authService: createAuthService({ userRepository, passwordHasher, tokenService, clock, idGenerator }),
    userService: createUserService({ userRepository }),
    auctionService: createAuctionService({
      auctionRepository,
      eventPublisher,
      settlement,
      auctionLock,
      clock,
      idGenerator,
    }),
    orderService: createOrderService({ orderRepository, auctionRepository, settlement, auctionLock, clock }),
    webhookService: createWebhookService({
      signatureVerifier,
      webhookEventRepository,
      orderRepository,
      auctionRepository,
      settlement,
      auctionLock,
      clock,
    }),
  };
};

export type Services = ReturnType<typeof createServices>;
