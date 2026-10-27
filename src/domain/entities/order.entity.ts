import { OrderExpiredError } from "../errors/domain.error";
import { Money } from "../value-objects/money.vo";
import { OrderStatus } from "../value-objects/order-status.vo";

/** RN-15: the winner has 48 hours to pay */
export const PAYMENT_DEADLINE_MS = 48 * 60 * 60 * 1000;

export interface IOrderProps {
  id: string;
  auctionId: string;
  winnerId: string;
  amount: Money;
  status: OrderStatus;
  createdAt: Date;
  expiresAt: Date;
  paidAt: Date | null;
}

export interface ICreateOrderProps {
  id: string;
  auctionId: string;
  winnerId: string;
  amount: Money;
  /** Moment the auction was awarded its closing date */
  awardedAt: Date;
  now: Date;
}

export class PaymentOrder {
  readonly id: string;
  readonly auctionId: string;
  readonly winnerId: string;
  readonly amount: Money;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  private _status: OrderStatus;
  private _paidAt: Date | null;

  private constructor(props: IOrderProps) {
    this.id = props.id;
    this.auctionId = props.auctionId;
    this.winnerId = props.winnerId;
    this.amount = props.amount;
    this.createdAt = props.createdAt;
    this.expiresAt = props.expiresAt;
    this._status = props.status;
    this._paidAt = props.paidAt;
  }

  /**
  RN-15: order for the winning amount, deadline = award moment + 48h
  The deadline is counted from the auction's closing date the real award
  moment not from when the lazy evaluation happened to run that way the
  outcome is the same no matter when somebody looks at the auction
   */
  static createForAward(props: ICreateOrderProps): PaymentOrder {
    return new PaymentOrder({
      id: props.id,
      auctionId: props.auctionId,
      winnerId: props.winnerId,
      amount: props.amount,
      status: "PENDING",
      createdAt: props.now,
      expiresAt: new Date(props.awardedAt.getTime() + PAYMENT_DEADLINE_MS),
      paidAt: null,
    });
  }

  static restore(props: IOrderProps): PaymentOrder {
    return new PaymentOrder(props);
  }

  get status(): OrderStatus {
    return this._status;
  }

  get paidAt(): Date | null {
    return this._paidAt;
  }

  /**
   * RN-17: the ONLY way an order becomes PAID. It is called exclusively by the
   * payment webhook use case, never automatically by the platform.
   *
   * Returns true when the order changed to PAID, false when it was already PAID
   * (idempotent, RN-19). Throws OrderExpiredError when the 48h deadline has
   * passed (RN-20).
   */
  markAsPaid(now: Date): boolean {
    if (this._status === "PAID") {
      return false;
    }
    if (this._status === "EXPIRED" || now.getTime() > this.expiresAt.getTime()) {
      throw new OrderExpiredError("The payment deadline of this order has passed.");
    }
    this._status = "PAID";
    this._paidAt = now;
    return true;
  }

  /**
   * RN-20 (lazy): a pending order past its deadline expires.
   * Returns true only the moment it changes to EXPIRED.
   */
  expireIfDue(now: Date): boolean {
    if (this._status !== "PENDING" || now.getTime() <= this.expiresAt.getTime()) {
      return false;
    }
    this._status = "EXPIRED";
    return true;
  }
}
