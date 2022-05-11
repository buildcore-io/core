import { BillPaymentTransaction, CreditPaymentTransaction, OrderTransaction, PaymentTransaction } from "../../interfaces/models";

export type OrderPayBillCreditTransaction = OrderTransaction | PaymentTransaction | BillPaymentTransaction | CreditPaymentTransaction

const MAX_RERUNS = 10

export const guardedRerun = async (func: () => Promise<boolean>, maxRuns = MAX_RERUNS) => {
  let runGuard = 0
  let shouldRerun = await func()
  while (shouldRerun) {
    if (runGuard === maxRuns) {
      throw Error('Max runs limit reached: ' + maxRuns)
    }
    shouldRerun = await func()
    ++runGuard;
  }
}
