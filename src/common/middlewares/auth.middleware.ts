import { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError";
import { readSessionCookie, verifySessionToken } from "../session";
import { userRepository } from "../../modules/user/user.repository";

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = readSessionCookie(req.headers.cookie);
  const userId = token ? verifySessionToken(token) : undefined;

  if (!userId || !userRepository.findById(userId)) {
    next(new AppError("Требуется авторизация", 401));
    return;
  }

  req.authUserId = userId;
  next();
}
