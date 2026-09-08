import { Router } from "express";
import { studentController } from "./student.controller";

export const studentRouter = Router();

studentRouter.get("/", studentController.getAll);
studentRouter.get("/:id", studentController.getById);
studentRouter.post("/", studentController.create);
studentRouter.patch("/:id", studentController.update);
studentRouter.put("/:id", studentController.update);
studentRouter.delete("/:id", studentController.delete);
