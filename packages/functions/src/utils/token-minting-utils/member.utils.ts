import { Token, TokenDrop } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { Wallet } from '../../services/wallet/wallet';
import { packBasicOutput } from '../basic-output.utils';

export const dropToOutput = (
  wallet: Wallet,
  token: Token,
  drop: TokenDrop,
  targetAddress: string,
) => {
  const nativeTokens = drop.isBaseToken
    ? undefined
    : [{ amount: BigInt(drop.count), id: token.mintingData?.tokenId! }];
  const vestingAt = dayjs(drop.vestingAt.toDate()).isAfter(dayjs()) ? drop.vestingAt : undefined;
  return packBasicOutput(wallet, targetAddress, 0, { nativeTokens, vestingAt });
};
