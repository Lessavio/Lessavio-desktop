export const CURRENCIES = ["UAH"] as const;
export type Currency = (typeof CURRENCIES)[number];

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  currency: Currency;
  createdAt: Date;
  updatedAt: Date;
}

export type PublicUser = Omit<User, "passwordHash">;

export interface CreateUserDto {
  name: string;
  email: string;
  passwordHash: string;
  currency: Currency;
}
