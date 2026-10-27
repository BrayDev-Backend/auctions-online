/**
 * Minimal console logger (RNF-17). One place to change the format, or to swap
 * it for pino/winston later.
 */
const timestamp = (): string => new Date().toISOString();

export const logger = {
  info(message: string, data?: unknown): void {
    console.log(`[${timestamp()}] INFO  ${message}`, data ?? "");
  },
  event(name: string, data: unknown): void {
    console.log(`[${timestamp()}] EVENT ${name}`, JSON.stringify(data));
  },
  warn(message: string, data?: unknown): void {
    console.warn(`[${timestamp()}] WARN  ${message}`, data ?? "");
  },
  error(message: string, error?: unknown): void {
    console.error(`[${timestamp()}] ERROR ${message}`, error ?? "");
  },
};

export type Logger = typeof logger;
