import { Router } from "express";
import { lessonController } from "./lesson.controller";

export const lessonRouter = Router();

lessonRouter.get("/", lessonController.getAll);
lessonRouter.get("/:id", lessonController.getById);
lessonRouter.post("/", lessonController.create);
lessonRouter.patch("/:id", lessonController.update);
lessonRouter.put("/:id", lessonController.update);
lessonRouter.delete("/:id", lessonController.delete);
