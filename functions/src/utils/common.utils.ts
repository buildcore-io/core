import { BillPaymentTransaction, CreditPaymentTransaction, OrderTransaction, PaymentTransaction } from "../../interfaces/models";

export type OrderPayBillCreditTransaction = OrderTransaction | PaymentTransaction | BillPaymentTransaction | CreditPaymentTransaction
