import express from "express";
import path from "path";
import { errorMiddleware } from "./common/middlewares/error.middleware";
import { requireAuth } from "./common/middlewares/auth.middleware";
import { lessonRouter } from "./modules/lesson/lesson.router";
import { studentRouter } from "./modules/student/student.router";
import { authRouter } from "./modules/user/user.router";

const app = express();
const publicDirectory = path.resolve(__dirname, "../client/dist");

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});
app.use("/api/auth", authRouter);
app.use("/api/students", requireAuth, studentRouter);
app.use("/api/lessons", requireAuth, lessonRouter);

app.use("/api", (_req, res) => {
    res.status(404).json({ status: "error", message: "API-маршрут не найден" });
});

app.use(express.static(publicDirectory));
app.get("*", (_req, res) => {
    res.sendFile(path.join(publicDirectory, "index.html"));
});

app.use(errorMiddleware);

export { app };
