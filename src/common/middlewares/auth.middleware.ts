import { NextFunction, Request, Response } from "express";
import { userRepository } from "../../modules/user/user.repository";
import { AppError } from "../errors/AppError";
import { readSessionCookie, verifySessionToken } from "../session";

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = readSessionCookie(req.headers.cookie);
    const userId = token ? verifySessionToken(token) : undefined;

    if (!userId || !(await userRepository.findById(userId))) {
      next(new AppError("Требуется авторизация", 401));
      return;
    }

    req.authUserId = userId;
    next();
  } catch (error) {
    next(error);
  }
}
