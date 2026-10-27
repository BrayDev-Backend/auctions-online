import "dotenv/config";
import { z } from "zod";

/**
 * Reads and VALIDATES environment variables once, at startup (RNF-10).
 * If something is missing the app fails fast with a clear message instead of
 * crashing later in a random place.
 */
const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  PERSISTENCE: z.enum(["postgres", "memory"]).default("postgres"),
  DATABASE_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must have at least 16 characters"),
  JWT_EXPIRES_IN: z.string().regex(/^\d+[smhd]?$/, 'Use values like "3600", "15m", "1h", "7d"').default("1h"),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
  CORS_ORIGIN: z.string().default("*"),
  WEBHOOK_SECRET: z.string().min(16, "WEBHOOK_SECRET must have at least 16 characters"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
  throw new Error(`Invalid environment configuration:\n${details}`);
}

if (parsed.data.PERSISTENCE === "postgres" && !parsed.data.DATABASE_URL) {
  throw new Error("Invalid environment configuration:\n  - DATABASE_URL is required when PERSISTENCE=postgres");
}

export const env = parsed.data;
export type Env = typeof env;
