import { WebhookEventConflictError } from "../../../domain/errors/domain.error";
import {
  IProcessedWebhookEvent,
  IWebhookEventRepository,
} from "../../../domain/ports/webhook-event.repository.port";

export class InMemoryWebhookEventRepository implements IWebhookEventRepository {
  private readonly events = new Map<string, IProcessedWebhookEvent>();

  async findByEventId(eventId: string): Promise<IProcessedWebhookEvent | null> {
    const event = this.events.get(eventId);
    return event === undefined ? null : { ...event };
  }

  async save(event: IProcessedWebhookEvent): Promise<void> {
    if (this.events.has(event.eventId)) {
      throw new WebhookEventConflictError(`Event "${event.eventId}" was already processed.`);
    }
    this.events.set(event.eventId, { ...event });
  }

  /** Helper for tests. */
  count(): number {
    return this.events.size;
  }
}
