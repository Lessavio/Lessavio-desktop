import { Router } from "express";
import { paymentPeriodController } from "./payment-period.controller";

export const paymentPeriodRouter = Router();

paymentPeriodRouter.get("/", paymentPeriodController.getAll);
paymentPeriodRouter.post("/", paymentPeriodController.create);
paymentPeriodRouter.post("/:id/payments", paymentPeriodController.addPayment);
paymentPeriodRouter.patch("/:id/payments/:paymentId", paymentPeriodController.updatePayment);
paymentPeriodRouter.delete("/:id/payments/:paymentId", paymentPeriodController.deletePayment);
paymentPeriodRouter.delete("/:id", paymentPeriodController.delete);
