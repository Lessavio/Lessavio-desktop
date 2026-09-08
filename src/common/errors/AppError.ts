// Кастомный класс ошибок — позволяет задать HTTP-код и сообщение
// Бросаем его в сервисах, ловим в error middleware

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // Отличаем "наши" ошибки от неожиданных

    // Чтобы instanceof работал корректно с наследованием
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
