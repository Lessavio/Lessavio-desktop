import { AppError } from "../../common/errors/AppError";
import { asObject, requiredNumber, requiredString } from "../../common/validation";
import { studentRepository } from "../student/student.repository";
import { CreatePaymentPeriodDto, PaymentPeriod } from "./payment-period.model";
import { paymentPeriodRepository } from "./payment-period.repository";

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat("en-CA-u-ca-gregory-nu-latn", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    throw new AppError("Указан недопустимый часовой пояс", 400);
  }
}

function partsAt(formatter: Intl.DateTimeFormat, instant: Date): ZonedParts {
  const parts = Object.fromEntries(
    formatter.formatToParts(instant)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );
  return parts as unknown as ZonedParts;
}

function utcTimestamp(parts: ZonedParts): number {
  const instant = new Date(0);
  instant.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  instant.setUTCHours(parts.hour, parts.minute, parts.second, 0);
  return instant.getTime();
}

function zonedMonthStart(year: number, month: number, formatter: Intl.DateTimeFormat): Date {
  const target: ZonedParts = { year, month, day: 1, hour: 0, minute: 0, second: 0 };
  const targetTimestamp = utcTimestamp(target);
  const searchRadius = 4 * 24 * 60 * 60 * 1000;
  const stepSeconds = 30 * 60;
  const firstSecond = Math.floor((targetTimestamp - searchRadius) / 1000);
  const lastSecond = Math.ceil((targetTimestamp + searchRadius) / 1000);
  const isTargetMonth = (second: number): boolean => {
    const parts = partsAt(formatter, new Date(second * 1000));
    return parts.year === year && parts.month === month;
  };

  let matchingSecond: number | undefined;
  for (let second = firstSecond; second <= lastSecond; second += stepSeconds) {
    if (isTargetMonth(second)) {
      matchingSecond = second;
      break;
    }
  }
  if (matchingSecond === undefined) {
    throw new AppError("Не удалось определить границы месяца в указанном часовом поясе", 400);
  }

  let lower = matchingSecond - stepSeconds;
  let upper = matchingSecond;
  while (lower + 1 < upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (isTargetMonth(middle)) upper = middle;
    else lower = middle;
  }
  return new Date(upper * 1000);
}

function canonicalMonthRange(month: string, timeZone: string): { startsAt: Date; endsAt: Date } {
  const match = MONTH_PATTERN.exec(month);
  if (!match) {
    throw new AppError("Поле «Месяц» должно быть в формате YYYY-MM", 400);
  }
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (year < 1970 || year > 9999) {
    throw new AppError("Поле «Месяц» должно быть в формате YYYY-MM", 400);
  }
  const formatter = formatterFor(timeZone);
  const nextYear = monthNumber === 12 ? year + 1 : year;
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
  return {
    startsAt: zonedMonthStart(year, monthNumber, formatter),
    endsAt: zonedMonthStart(nextYear, nextMonth, formatter),
  };
}

async function parseCreate(ownerId: string, input: unknown): Promise<CreatePaymentPeriodDto> {
  const data = asObject(input);
  const studentId = requiredString(data, "studentId", "Ученик", 40);
  const student = await studentRepository.findById(ownerId, studentId);
  if (!student || student.archived) {
    throw new AppError("Активный ученик не найден", 404);
  }

  const month = requiredString(data, "month", "Месяц", 7);
  const timeZone = requiredString(data, "timeZone", "Часовой пояс", 100);
  const amount = requiredNumber(data, "amount", "Сумма", 0.01, 1_000_000);
  const { startsAt, endsAt } = canonicalMonthRange(month, timeZone);
  return { studentId, month, timeZone, amount, startsAt, endsAt };
}

function parsePaymentAmount(input: unknown): number {
  return requiredNumber(asObject(input), "amount", "Сумма", 0.01, 1_000_000);
}

export const paymentPeriodService = {
  getAll(ownerId: string): Promise<PaymentPeriod[]> {
    return paymentPeriodRepository.findAll(ownerId);
  },

  async create(ownerId: string, input: unknown): Promise<PaymentPeriod> {
    const dto = await parseCreate(ownerId, input);
    const result = await paymentPeriodRepository.create(ownerId, dto);
    if (!result.studentActive) {
      throw new AppError("Активный ученик не найден", 404);
    }
    if (result.conflict === "duplicate") {
      throw new AppError("Период оплаты за этот месяц уже существует", 409);
    }
    if (result.conflict === "overlap") {
      throw new AppError("Период оплаты пересекается с существующим периодом", 409);
    }
    if (!result.period) {
      throw new AppError("Не удалось создать период оплаты", 409);
    }
    return result.period;
  },

  async addPayment(ownerId: string, periodId: string, input: unknown): Promise<PaymentPeriod> {
    const period = await paymentPeriodRepository.addPayment(
      ownerId,
      periodId,
      parsePaymentAmount(input)
    );
    if (!period) {
      throw new AppError("Период оплаты не найден", 404);
    }
    return period;
  },

  async updatePayment(
    ownerId: string,
    periodId: string,
    paymentId: string,
    input: unknown
  ): Promise<PaymentPeriod> {
    const result = await paymentPeriodRepository.updatePayment(
      ownerId,
      periodId,
      paymentId,
      parsePaymentAmount(input)
    );
    if (!result.periodFound) {
      throw new AppError("Период оплаты не найден", 404);
    }
    if (!result.paymentFound) {
      throw new AppError("Платёж не найден", 404);
    }
    if (!result.period) {
      throw new AppError("Не удалось обновить платёж", 409);
    }
    return result.period;
  },

  async deletePayment(ownerId: string, periodId: string, paymentId: string): Promise<void> {
    const result = await paymentPeriodRepository.deletePayment(ownerId, periodId, paymentId);
    if (result === "period_not_found") {
      throw new AppError("Период оплаты не найден", 404);
    }
    if (result === "payment_not_found") {
      throw new AppError("Платёж не найден", 404);
    }
    if (result === "last_payment") {
      throw new AppError(
        "Нельзя удалить последний платёж. Удалите весь оплаченный месяц вместо этого",
        409
      );
    }
  },

  async delete(ownerId: string, id: string): Promise<void> {
    if (!(await paymentPeriodRepository.delete(ownerId, id))) {
      throw new AppError("Период оплаты не найден", 404);
    }
  },
};
