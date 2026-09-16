export interface PaymentEntry {
  id: string;
  ownerId: string;
  studentId: string;
  paymentPeriodId: string;
  amount: number;
  paidAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentPeriod {
  id: string;
  ownerId: string;
  studentId: string;
  month: string;
  timeZone: string;
  amount: number;
  startsAt: Date;
  endsAt: Date;
  paidAt: Date;
  createdAt: Date;
  updatedAt: Date;
  payments: PaymentEntry[];
}

export interface CreatePaymentPeriodDto {
  studentId: string;
  month: string;
  timeZone: string;
  amount: number;
  startsAt: Date;
  endsAt: Date;
}
