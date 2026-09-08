import { loadCollection, saveCollection } from "../../common/storage";
import { CreateUserDto, User } from "./user.model";

function revive(value: unknown): User {
  const user = value as User;
  return {
    ...user,
    email: String(user.email).toLowerCase(),
    currency: "UAH",
    createdAt: new Date(user.createdAt),
    updatedAt: new Date(user.updatedAt),
  };
}

let users = loadCollection<User>("users", revive);
let nextId = users.reduce((max, user) => Math.max(max, Number(user.id) || 0), 0) + 1;

function clone(user: User): User {
  return { ...user };
}

function persist(): void {
  saveCollection("users", users);
}

export const userRepository = {
  count(): number {
    return users.length;
  },

  findById(id: string): User | undefined {
    const user = users.find((item) => item.id === id);
    return user ? clone(user) : undefined;
  },

  findByEmail(email: string): User | undefined {
    const normalizedEmail = email.toLowerCase();
    const user = users.find((item) => item.email === normalizedEmail);
    return user ? clone(user) : undefined;
  },

  create(dto: CreateUserDto): User {
    const now = new Date();
    const user: User = {
      id: String(nextId++),
      ...dto,
      email: dto.email.toLowerCase(),
      createdAt: now,
      updatedAt: now,
    };
    users.push(user);
    persist();
    return clone(user);
  },
};
