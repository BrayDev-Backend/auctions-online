/*
This entity is for save the rejected bid for auditig later
amount is row because it could be a reject bid for an invaid amount
 */
export interface IRejectedBidProps {
  id: string;
  auctionId: string;
  bidderId: string;
  amount: number;
  reasonCode: string;
  reasonMessage: string;
  attemptedAt: Date;
}

export class RejectedBidAttempt {
  readonly id: string;
  readonly auctionId: string;
  readonly bidderId: string;
  readonly amount: number;
  readonly reasonCode: string;
  readonly reasonMessage: string;
  readonly attemptedAt: Date;

  constructor(props: IRejectedBidProps) {
    this.id = props.id;
    this.auctionId = props.auctionId;
    this.bidderId = props.bidderId;
    this.amount = props.amount;
    this.reasonCode = props.reasonCode;
    this.reasonMessage = props.reasonMessage;
    this.attemptedAt = props.attemptedAt;
  }
}
