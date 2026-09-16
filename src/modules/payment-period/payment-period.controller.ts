import { NextFunction, Request, Response } from "express";
import { paymentPeriodService } from "./payment-period.service";

export const paymentPeriodController = {
  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await paymentPeriodService.getAll(req.authUserId as string));
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(201).json(
        await paymentPeriodService.create(req.authUserId as string, req.body)
      );
    } catch (error) {
      next(error);
    }
  },

  async addPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(201).json(
        await paymentPeriodService.addPayment(
          req.authUserId as string,
          req.params.id,
          req.body
        )
      );
    } catch (error) {
      next(error);
    }
  },

  async updatePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(
        await paymentPeriodService.updatePayment(
          req.authUserId as string,
          req.params.id,
          req.params.paymentId,
          req.body
        )
      );
    } catch (error) {
      next(error);
    }
  },

  async deletePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await paymentPeriodService.deletePayment(
        req.authUserId as string,
        req.params.id,
        req.params.paymentId
      );
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await paymentPeriodService.delete(req.authUserId as string, req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
};
