import { build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  SUB_COL,
  StakeType,
  TangleRequestType,
  TokenDistribution,
  Transaction,
} from '@build-5/interfaces';
import { wait } from '../../test/controls/common';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet, requestMintedTokenFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Stake reward test test', () => {
  const helper = new Helper();
  let tangleOrder: Transaction;

  beforeAll(async () => {
    await helper.beforeAll();
    tangleOrder = await getTangleOrder(Network.RMS);
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it.each([StakeType.STATIC, StakeType.DYNAMIC])(
    'Should stake with tangle request',
    async (type: StakeType) => {
      const tmp = await helper.walletService!.getNewIotaAddressDetails();
      await requestFundsFromFaucet(Network.RMS, tmp.bech32, 10 * MIN_IOTA_AMOUNT);
      await requestMintedTokenFromFaucet(
        helper.walletService!,
        tmp,
        helper.MINTED_TOKEN_ID,
        helper.VAULT_MNEMONIC,
        100,
      );

      await helper.walletService!.send(tmp, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
        nativeTokens: [{ id: helper.token?.mintingData?.tokenId!, amount: BigInt(100) }],
        customMetadata: {
          request: {
            requestType: TangleRequestType.STAKE,
            weeks: 52,
            symbol: helper.token?.symbol,
            type,
            customMetadata: {
              name: 'myrandomstake',
            },
          },
        },
      });
      await build5Db().doc(COL.MNEMONIC, tmp.bech32).update({ consumedOutputIds: [] });

      await wait(async () => {
        const distributionDocRef = build5Db().doc(
          COL.TOKEN,
          helper.token!.uid,
          SUB_COL.DISTRIBUTION,
          tmp.bech32,
        );
        const distribution = <TokenDistribution>await distributionDocRef.get();
        return (distribution?.stakes || {})[type]?.value === 200;
      });
    },
  );
});
