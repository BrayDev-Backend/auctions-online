export const AUCTION_STATUSES = [
  "OPEN", /*auction open*/
  "CANCELLED", /*auction closed by the owner but without any winner*/
  "CLOSED", /*auction closed by the owner but with a winner*/
  "DESERTED", /*auction closed by time because no one do a bid*/
  "BREACH", /*auction closed beacuse the winner did not payed*/
] as const;

export type AuctionStatus = (typeof AUCTION_STATUSES)[number];

export const isAuctionStatus = (value: string): value is AuctionStatus =>
  (AUCTION_STATUSES as readonly string[]).includes(value);
