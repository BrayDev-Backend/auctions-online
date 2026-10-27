import { randomUUID } from "node:crypto";
import { IClock, IIdGenerator } from "../../domain/ports/system.port";

export class SystemClock implements IClock {
  now(): Date {
    return new Date();
  }
}

export class UuidGenerator implements IIdGenerator {
  generate(): string {
    return randomUUID();
  }
}
