import { NextFunction, Request, Response } from "express";
import { lessonService } from "./lesson.service";

export const lessonController = {
  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await lessonService.getAll(req.authUserId as string, req.query));
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await lessonService.getById(req.authUserId as string, req.params.id));
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(201).json(await lessonService.create(req.authUserId as string, req.body));
    } catch (error) {
      next(error);
    }
  },

  async createSeries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(201).json(
        await lessonService.createSeries(req.authUserId as string, req.body)
      );
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(
        await lessonService.update(req.authUserId as string, req.params.id, req.body)
      );
    } catch (error) {
      next(error);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await lessonService.delete(req.authUserId as string, req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
};
