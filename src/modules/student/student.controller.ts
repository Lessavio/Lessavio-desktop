import { NextFunction, Request, Response } from "express";
import { studentService } from "./student.service";

export const studentController = {
  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(
        await studentService.getAll(
          req.authUserId as string,
          req.query.includeArchived === "true"
        )
      );
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await studentService.getById(req.authUserId as string, req.params.id));
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(201).json(await studentService.create(req.authUserId as string, req.body));
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(
        await studentService.update(req.authUserId as string, req.params.id, req.body)
      );
    } catch (error) {
      next(error);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await studentService.delete(req.authUserId as string, req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
};
