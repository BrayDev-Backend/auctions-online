import { describe, expect, it } from "vitest";
import { InvalidEmailError, InvalidMoneyError } from "../../src/domain/errors/domain.error";
import { Email } from "../../src/domain/value-objects/email.vo";
import { Money } from "../../src/domain/value-objects/money.vo";

describe("Money (RN-21)", () => {
  it("accepts non-negative integers", () => {
    expect(Money.create(0).value).toBe(0);
    expect(Money.create(150_000).value).toBe(150_000);
  });

  it("rejects decimals", () => {
    expect(() => Money.create(10.5)).toThrow(InvalidMoneyError);
  });

  it("rejects negatives", () => {
    expect(() => Money.create(-1)).toThrow(InvalidMoneyError);
  });

  it("rejects NaN and Infinity", () => {
    expect(() => Money.create(Number.NaN)).toThrow(InvalidMoneyError);
    expect(() => Money.create(Number.POSITIVE_INFINITY)).toThrow(InvalidMoneyError);
  });

  it("createPositive rejects zero", () => {
    expect(() => Money.createPositive(0)).toThrow(InvalidMoneyError);
  });

  it("is immutable: add returns a new value", () => {
    const a = Money.create(100);
    const b = a.add(Money.create(50));
    expect(a.value).toBe(100);
    expect(b.value).toBe(150);
  });
});

describe("Email (RN-22)", () => {
  it("normalizes case and spaces", () => {
    expect(Email.create("  Ana@Example.COM ").value).toBe("ana@example.com");
  });

  it("rejects malformed emails", () => {
    expect(() => Email.create("not-an-email")).toThrow(InvalidEmailError);
    expect(() => Email.create("a@b")).toThrow(InvalidEmailError);
  });
});
