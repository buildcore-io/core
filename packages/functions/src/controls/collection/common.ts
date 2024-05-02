import { DiscountLine, WenError } from '@buildcore/interfaces';
import { uniq } from 'lodash';
import { invalidArgument } from '../../utils/error.utils';
import { getTokenBySymbol } from '../../utils/token.utils';

export const populateTokenUidOnDiscounts = async (discounts: DiscountLine[]) => {
  const symbols = uniq(discounts.map((d) => d.tokenSymbol));
  const promises = symbols.map(getTokenBySymbol);
  const tokens = await Promise.all(promises);
  return discounts.map((discount) => {
    const token = tokens.find((t) => t?.symbol === discount.tokenSymbol);
    if (!token) {
      throw invalidArgument(WenError.token_does_not_exist);
    }
    return { ...discount, tokenUid: token.uid };
  });
};
