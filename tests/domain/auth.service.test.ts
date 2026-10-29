import { describe, expect, it } from "vitest";
import {
  EmailAlreadyInUseError,
  InvalidCredentialsError,
  InvalidEmailError,
  InvalidTokenError,
} from "../../src/domain/errors/domain.error";
import { buildTestContext } from "../helpers/context";

const register = (ctx: ReturnType<typeof buildTestContext>, email = "ana@example.com") =>
  ctx.authService.registerUser({ name: "Ana", email, password: "Password123!" });

describe("Auth use cases", () => {
  it("registers a user and returns a verifiable JWT", async () => {
    const ctx = buildTestContext();
    const { token, user } = await register(ctx);

    expect(ctx.tokenService.verify(token)).toEqual({ userId: user.id, email: "ana@example.com" });
  });

  it("RN-22: stores only the password HASH", async () => {
    const ctx = buildTestContext();
    const { user } = await register(ctx);

    expect(user.passwordHash).not.toBe("Password123!");
    expect(user.passwordHash).not.toContain("Password123!".toLowerCase());
    expect((await ctx.userRepository.findById(user.id))?.passwordHash).toBe(user.passwordHash);
  });

  it("RN-22: emails are unique, ignoring case", async () => {
    const ctx = buildTestContext();
    await register(ctx, "ana@example.com");
    await expect(register(ctx, "ANA@Example.com")).rejects.toThrow(EmailAlreadyInUseError);
  });

  it("rejects malformed emails", async () => {
    const ctx = buildTestContext();
    await expect(register(ctx, "nope")).rejects.toThrow(InvalidEmailError);
  });

  it("logs in with the right credentials", async () => {
    const ctx = buildTestContext();
    const { user } = await register(ctx);
    const login = await ctx.authService.loginUser({ email: "Ana@example.com", password: "Password123!" });
    expect(login.user.id).toBe(user.id);
  });

  it("gives the SAME error for a wrong password and an unknown email", async () => {
    const ctx = buildTestContext();
    await register(ctx);
    const wrongPassword = ctx.authService.loginUser({ email: "ana@example.com", password: "wrong-password" });
    const unknownEmail = ctx.authService.loginUser({ email: "ghost@example.com", password: "Password123!" });

    await expect(wrongPassword).rejects.toThrow(InvalidCredentialsError);
    await expect(unknownEmail).rejects.toThrow(InvalidCredentialsError);
  });
});

describe("JWT verification", () => {
  it("rejects garbage and tampered tokens", async () => {
    const ctx = buildTestContext();
    const { token } = await register(ctx);

    expect(() => ctx.tokenService.verify("garbage")).toThrow(InvalidTokenError);
    expect(() => ctx.tokenService.verify(`${token}x`)).toThrow(InvalidTokenError);
  });
});
