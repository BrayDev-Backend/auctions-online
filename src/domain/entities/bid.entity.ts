import { Money } from "../value-objects/money.vo";

export interface IBidProps {
  id: string;
  auctionId: string;
  bidderId: string;
  amount: Money;
  createdAt: Date;
}

/*
This entity looks for accepted bids
This ones aer permanent and irrevocable 
Every field is eadonly and i do not have methods for delete o modify a bid
 */
export class Bid {
  readonly id: string;
  readonly auctionId: string;
  readonly bidderId: string;
  readonly amount: Money;
  readonly createdAt: Date;

  constructor(props: IBidProps) {
    this.id = props.id;
    this.auctionId = props.auctionId;
    this.bidderId = props.bidderId;
    this.amount = props.amount;
    this.createdAt = props.createdAt;
  }
}
