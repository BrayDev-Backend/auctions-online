// Prisma CLI configuration (Prisma ORM 7).
// Used by `prisma generate`, `prisma migrate` and `prisma db seed` — NOT by the running app.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // process.env (instead of env()) so `prisma generate` also works without a DB configured.
    url: process.env["DATABASE_URL"],
  },
});
