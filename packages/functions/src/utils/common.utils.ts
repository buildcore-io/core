import {
  BillPaymentTransaction,
  CreditPaymentTransaction,
  MIN_AMOUNT_TO_TRANSFER,
  OrderTransaction,
  PaymentTransaction,
} from '@soonaverse/interfaces';

export type OrderPayBillCreditTransaction =
  | OrderTransaction
  | PaymentTransaction
  | BillPaymentTransaction
  | CreditPaymentTransaction;

const MAX_RERUNS = 10;

export const guardedRerun = async (func: () => Promise<boolean>, maxRuns = MAX_RERUNS) => {
  let runGuard = 0;
  let shouldRerun = await func();
  while (shouldRerun) {
    if (runGuard === maxRuns) {
      throw Error('Max runs limit reached: ' + maxRuns);
    }
    shouldRerun = await func();
    ++runGuard;
  }
};

export const generateRandomAmount = () => {
  const min = MIN_AMOUNT_TO_TRANSFER / 1000 / 10;
  return Math.floor(Math.random() * (min * 1.5 - min + 1) + min) * 1000 * 10;
};

export const getRandomElement = <T>(array: T[]) => array[Math.floor(Math.random() * array.length)];
