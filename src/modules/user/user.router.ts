import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { authController } from "./user.controller";

export const authRouter = Router();

authRouter.post("/register", authController.register);
authRouter.post("/login", authController.login);
authRouter.post("/logout", authController.logout);
authRouter.get("/me", requireAuth, authController.me);
