import { NextFunction, Request, Response } from "express";
import { studentService } from "./student.service";

export const studentController = {
  getAll(req: Request, res: Response, next: NextFunction): void {
    try {
      res.json(studentService.getAll(req.authUserId as string, req.query.includeArchived === "true"));
    } catch (error) {
      next(error);
    }
  },

  getById(req: Request, res: Response, next: NextFunction): void {
    try {
      res.json(studentService.getById(req.authUserId as string, req.params.id));
    } catch (error) {
      next(error);
    }
  },

  create(req: Request, res: Response, next: NextFunction): void {
    try {
      res.status(201).json(studentService.create(req.authUserId as string, req.body));
    } catch (error) {
      next(error);
    }
  },

  update(req: Request, res: Response, next: NextFunction): void {
    try {
      res.json(studentService.update(req.authUserId as string, req.params.id, req.body));
    } catch (error) {
      next(error);
    }
  },

  delete(req: Request, res: Response, next: NextFunction): void {
    try {
      studentService.delete(req.authUserId as string, req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
};
