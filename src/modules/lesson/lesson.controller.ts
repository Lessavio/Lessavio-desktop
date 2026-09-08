import { NextFunction, Request, Response } from "express";
import { lessonService } from "./lesson.service";

export const lessonController = {
  getAll(req: Request, res: Response, next: NextFunction): void {
    try {
      res.json(lessonService.getAll(req.authUserId as string, req.query));
    } catch (error) {
      next(error);
    }
  },

  getById(req: Request, res: Response, next: NextFunction): void {
    try {
      res.json(lessonService.getById(req.authUserId as string, req.params.id));
    } catch (error) {
      next(error);
    }
  },

  create(req: Request, res: Response, next: NextFunction): void {
    try {
      res.status(201).json(lessonService.create(req.authUserId as string, req.body));
    } catch (error) {
      next(error);
    }
  },

  update(req: Request, res: Response, next: NextFunction): void {
    try {
      res.json(lessonService.update(req.authUserId as string, req.params.id, req.body));
    } catch (error) {
      next(error);
    }
  },

  delete(req: Request, res: Response, next: NextFunction): void {
    try {
      lessonService.delete(req.authUserId as string, req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
};
