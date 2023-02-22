import { MAX_WEEKS_TO_STAKE } from './config';

const M = 1 / (MAX_WEEKS_TO_STAKE - 1);
const B = 2 - M * MAX_WEEKS_TO_STAKE;
export const calcStakedMultiplier = (weeks: number) => {
  const multiplier = Number((M * (weeks || 1) + B).toFixed(8));
  return Math.min(multiplier, 2);
};

export const generateRandomFileName = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c == 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
