import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError";

// Централизованная обработка ошибок
// Express распознаёт error middleware по 4 аргументам (err, req, res, next)

export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Если это наша ошибка — отдаём её код и сообщение
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      status: "error",
      message: err.message,
    });
    return;
  }

  // Неизвестная ошибка — 500
  console.error("Unexpected error:", err);
  res.status(500).json({
    status: "error",
    message: "Internal server error",
  });
}
