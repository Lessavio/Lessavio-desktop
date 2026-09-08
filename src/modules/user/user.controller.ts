import { NextFunction, Request, Response } from "express";
import { clearSessionCookie, createSessionToken, setSessionCookie } from "../../common/session";
import { userService } from "./user.service";

export const authController = {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.register(req.body);
      setSessionCookie(res, createSessionToken(user.id));
      res.status(201).json(user);
    } catch (error) {
      next(error);
    }
  },

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.login(req.body);
      setSessionCookie(res, createSessionToken(user.id));
      res.json(user);
    } catch (error) {
      next(error);
    }
  },

  logout(_req: Request, res: Response): void {
    clearSessionCookie(res);
    res.status(204).send();
  },

  me(req: Request, res: Response, next: NextFunction): void {
    try {
      res.json(userService.getMe(req.authUserId as string));
    } catch (error) {
      next(error);
    }
  },
};
