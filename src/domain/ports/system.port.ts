/**
 OUTPUT PORTS for "now" and for new ids
 Injecting them instead of calling `new Date()` / `randomUUID()` inside the domain
 */
export interface IClock {
  now(): Date;
}

export interface IIdGenerator {
  generate(): string;
}
