import { MAX_WEEKS_TO_STAKE } from './config';

const M = 1 / (MAX_WEEKS_TO_STAKE - 1);
const B = 2 - M * MAX_WEEKS_TO_STAKE;
export const calcStakedMultiplier = (weeks: number) => {
  const multiplier = Number((M * (weeks || 1) + B).toFixed(8));
  return Math.min(multiplier, 2);
};
