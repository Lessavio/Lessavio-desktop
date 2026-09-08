import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { AppError } from "../../common/errors/AppError";
import { asObject, requiredString } from "../../common/validation";
import { lessonRepository } from "../lesson/lesson.repository";
import { studentRepository } from "../student/student.repository";
import { PublicUser, User } from "./user.model";
import { userRepository } from "./user.repository";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keyLength: number
) => Promise<Buffer>;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HASH_PREFIX = "scrypt";
const KEY_LENGTH = 64;
const DUMMY_SALT = Buffer.alloc(16).toString("base64url");
const DUMMY_HASH = Buffer.alloc(KEY_LENGTH).toString("base64url");

function publicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...result } = user;
  return result;
}

function normalizedEmail(value: unknown): string {
  if (typeof value !== "string") throw new AppError("Некорректный email", 400);
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw new AppError("Некорректный email", 400);
  }
  return email;
}

function password(value: unknown): string {
  if (typeof value !== "string" || value.length < 8 || value.length > 128) {
    throw new AppError("Пароль должен содержать от 8 до 128 символов", 400);
  }
  return value;
}

async function hashPassword(value: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const derivedKey = await scryptAsync(value, salt, KEY_LENGTH);
  return `${HASH_PREFIX}$${salt}$${derivedKey.toString("base64url")}`;
}

async function verifyPassword(value: string, storedHash: string): Promise<boolean> {
  const [prefix, salt, encodedHash, extra] = storedHash.split("$");
  if (prefix !== HASH_PREFIX || !salt || !encodedHash || extra !== undefined) return false;
  try {
    const expected = Buffer.from(encodedHash, "base64url");
    if (expected.length !== KEY_LENGTH) return false;
    const actual = await scryptAsync(value, salt, KEY_LENGTH);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export const userService = {
  async register(input: unknown): Promise<PublicUser> {
    const data = asObject(input);
    const name = requiredString(data, "name", "Имя", 80);
    const email = normalizedEmail(data.email);
    const rawPassword = password(data.password);

    if (userRepository.findByEmail(email)) {
      throw new AppError("Пользователь с таким email уже существует", 409);
    }

    const passwordHash = await hashPassword(rawPassword);
    if (userRepository.findByEmail(email)) {
      throw new AppError("Пользователь с таким email уже существует", 409);
    }

    const isFirstUser = userRepository.count() === 0;
    const user = userRepository.create({ name, email, passwordHash, currency: "UAH" });
    if (isFirstUser) {
      studentRepository.claimOwnerless(user.id);
      lessonRepository.claimOwnerless(user.id);
    }
    return publicUser(user);
  },

  async login(input: unknown): Promise<PublicUser> {
    let data: ReturnType<typeof asObject>;
    let email: string;
    let rawPassword: string;
    try {
      data = asObject(input);
      email = normalizedEmail(data.email);
      rawPassword = password(data.password);
    } catch {
      throw new AppError("Неверный email или пароль", 401);
    }

    const user = userRepository.findByEmail(email);
    const valid = await verifyPassword(
      rawPassword,
      user?.passwordHash ?? `${HASH_PREFIX}$${DUMMY_SALT}$${DUMMY_HASH}`
    );
    if (!user || !valid) throw new AppError("Неверный email или пароль", 401);
    return publicUser(user);
  },

  getMe(id: string): PublicUser {
    const user = userRepository.findById(id);
    if (!user) throw new AppError("Требуется авторизация", 401);
    return publicUser(user);
  },
};
