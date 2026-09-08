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

  async logout(_req: Request, res: Response): Promise<void> {
    clearSessionCookie(res);
    res.status(204).send();
  },

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await userService.getMe(req.authUserId as string));
    } catch (error) {
      next(error);
    }
  },
};
