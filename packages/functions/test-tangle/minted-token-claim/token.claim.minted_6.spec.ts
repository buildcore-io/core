/* eslint-disable @typescript-eslint/no-explicit-any */

import { database } from '@buildcore/database';
import {
  COL,
  SUB_COL,
  Token,
  TokenDistribution,
  Transaction,
  WEN_FUNC,
  WenError,
} from '@buildcore/interfaces';
import { expectThrow, wait } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
import { awaitTransactionConfirmationsForToken } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Token minting', () => {
  const helper = new Helper();

  beforeEach(async () => {
    await helper.beforeEach(VAULT_MNEMONIC, MINTED_TOKEN_ID);
  });

  it('Should throw, nothing to claim, can not create order', async () => {
    await database()
      .doc(COL.TOKEN, helper.token.uid, SUB_COL.DISTRIBUTION, helper.guardian.uid)
      .upsert({ tokenOwned: 1 });
    mockWalletReturnValue(helper.guardian.uid, { symbol: helper.token.symbol });
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.claimMintedTokenOrder);
    await requestFundsFromFaucet(helper.network, order.payload.targetAddress, order.payload.amount);

    await wait(async () => {
      const distributionDocRef = database().doc(
        COL.TOKEN,
        helper.token.uid,
        SUB_COL.DISTRIBUTION,
        helper.guardian.uid,
      );
      const distribution = <TokenDistribution>await distributionDocRef.get();
      return distribution.mintedClaimedOn !== undefined;
    });

    await expectThrow(
      testEnv.wrap<Transaction>(WEN_FUNC.claimMintedTokenOrder),
      WenError.no_tokens_to_claim.key,
    );

    const tokenData = <Token>await database().doc(COL.TOKEN, helper.token.uid).get();
    expect(tokenData.mintingData?.tokensInVault).toBe(9);

    await awaitTransactionConfirmationsForToken(helper.token.uid);
  });
});

export const VAULT_MNEMONIC =
  'grief supreme rural sugar coral finish muffin giraffe require slice hurdle annual opera concert skirt enough hood hollow clip inner home return almost regular';
export const MINTED_TOKEN_ID =
  '0x083e0ec0612f9429e95cc23bc9110a2a119a65f0a4cdf5cccabb99bb135e5afb590100000000';
