import { InvalidMoneyError } from "../errors/domain.error";

export class Money {
  private constructor(readonly value: number) {
    Object.freeze(this);
  }

  static create(amount: number): Money {
    if (!Number.isSafeInteger(amount)) {
      throw new InvalidMoneyError("Money must be an integer amount of COP (no decimals).");
    }
    if (amount < 0) {
      throw new InvalidMoneyError("Money cannot be negative.");
    }
    return new Money(amount);
  }

  static createPositive(amount: number): Money {
    const money = Money.create(amount);
    if (money.value === 0) {
      throw new InvalidMoneyError("Amount must be greater than 0 COP.");
    }
    return money;
  }

  add(other: Money): Money {
    return Money.create(this.value + other.value);
  }

  isGreaterThan(other: Money): boolean {
    return this.value > other.value;
  }

  isGreaterThanOrEqual(other: Money): boolean {
    return this.value >= other.value;
  }

  equals(other: Money): boolean {
    return this.value === other.value;
  }

  toJSON(): number {
    return this.value;
  }
}
