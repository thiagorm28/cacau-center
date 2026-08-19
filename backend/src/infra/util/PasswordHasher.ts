import { Injectable } from "@nestjs/common";
import bcrypt from "bcryptjs";

export interface PasswordHasher {
  hash(plainText: string): Promise<string>;
  compare(plainText: string, hash: string): Promise<boolean>;
}

@Injectable()
export default class PasswordHasherBcrypt implements PasswordHasher {
  constructor(private readonly rounds = 10) {}

  hash(plainText: string): Promise<string> {
    return bcrypt.hash(plainText, this.rounds);
  }

  compare(plainText: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plainText, hash);
  }
}
