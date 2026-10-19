import { Email } from "../value-objects/email.vo";

export interface IUserProps {
  id: string;
  name: string;
  email: Email;
  passwordHash: string;
  createdAt: Date;
}

/**
A registered user can act as seller and as bidder
Only the HASH of the password is ever kept (RN-22 / RNF-16)
Contact info (email) is private (RN-23): presenters must never expose it
in public responses such as bid history
 */
export class User {
  readonly id: string;
  readonly name: string;
  readonly email: Email;
  readonly passwordHash: string;
  readonly createdAt: Date;

  constructor(props: IUserProps) {
    this.id = props.id;
    this.name = props.name;
    this.email = props.email;
    this.passwordHash = props.passwordHash;
    this.createdAt = props.createdAt;
  }
}
