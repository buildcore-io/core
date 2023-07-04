import { Timestamp, TokenAllocation, WenError } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';

export const shouldSetPublicSaleTimeFrames = (
  body: Record<string, unknown>,
  allocations: TokenAllocation[],
) => {
  const hasPublicSale = allocations.filter((a) => a.isPublicSale).length > 0;
  const count: number = (
    [body.saleStartDate, body.saleLength, body.coolDownLength] as number[]
  ).reduce((sum, act) => sum + (act === undefined ? 0 : 1), 0);
  if (count === 3 && !hasPublicSale) {
    throw invalidArgument(WenError.no_token_public_sale);
  }
  if (count > 0 && count < 3) {
    throw invalidArgument(WenError.invalid_params);
  }
  return count === 3;
};

export const getPublicSaleTimeFrames = (
  saleStartDate: Timestamp,
  saleLength: number,
  coolDownLength: number,
) => {
  const coolDownEnd = dayjs(saleStartDate.toDate()).add(saleLength + coolDownLength, 'ms');
  return { saleStartDate, saleLength, coolDownEnd: dateToTimestamp(coolDownEnd, true) };
};
