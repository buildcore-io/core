/* eslint-disable @typescript-eslint/no-explicit-any */

import { build5Db } from '@build-5/database';
import {
  COL,
  Member,
  Token,
  TokenStatus,
  Transaction,
  TransactionType,
  WEN_FUNC,
  WenError,
} from '@build-5/interfaces';
import { getAddress } from '../../src/utils/address.utils';
import { expectThrow, wait } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
import { awaitTransactionConfirmationsForToken } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Token minting', () => {
  const helper = new Helper();

  it('Should mint token and melt some', async () => {
    await helper.setup();
    mockWalletReturnValue(helper.guardian.uid, {
      token: helper.token.uid,
      network: helper.network,
    });
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.mintTokenOrder);
    await requestFundsFromFaucet(helper.network, order.payload.targetAddress, order.payload.amount);

    const tokenDocRef = build5Db().doc(COL.TOKEN, helper.token.uid);
    await wait(async () => {
      helper.token = <Token>await tokenDocRef.get();
      return helper.token.status === TokenStatus.MINTED;
    });

    const guardianData = <Member>await build5Db().doc(COL.MEMBER, helper.guardian.uid).get();
    const guardianAddress = getAddress(guardianData, helper.network);
    await wait(async () => {
      const { nativeTokens } = await helper.walletService.getBalance(guardianAddress);
      return Number(Object.values(nativeTokens)[0]) === 500;
    });

    await helper.meltMintedToken(helper.walletService, helper.token, 250, guardianAddress);

    await wait(async () => {
      helper.token = <Token>await tokenDocRef.get();
      return (
        helper.token.mintingData?.meltedTokens === 250 &&
        helper.token.mintingData?.circulatingSupply === 1250
      );
    });
  });

  it('Should create order, not approved but public', async () => {
    await helper.setup();
    await build5Db().doc(COL.TOKEN, helper.token.uid).update({ approved: false, public: true });
    mockWalletReturnValue(helper.guardian.uid, {
      token: helper.token.uid,
      network: helper.network,
    });
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.mintTokenOrder);
    expect(order).toBeDefined();
  });

  it('Should throw, member has no valid address', async () => {
    await helper.setup();
    await build5Db()
      .doc(COL.MEMBER, helper.guardian.uid)
      .update({ smrAddress: '', rmsAddress: '', iotaAddress: '', atoiAddress: '' });
    mockWalletReturnValue(helper.guardian.uid, {
      token: helper.token.uid,
      network: helper.network,
    });
    await expectThrow(
      testEnv.wrap<Transaction>(WEN_FUNC.mintTokenOrder),
      WenError.member_must_have_validated_address.key,
    );
  });

  it('Should throw, not guardian', async () => {
    await helper.setup();

    mockWalletReturnValue(helper.member, { token: helper.token.uid, network: helper.network });
    await expectThrow(
      testEnv.wrap<Transaction>(WEN_FUNC.mintTokenOrder),
      WenError.you_are_not_guardian_of_space.key,
    );
  });

  it('Should throw, already minted', async () => {
    await helper.setup();
    await build5Db().doc(COL.TOKEN, helper.token.uid).update({ status: TokenStatus.MINTED });
    mockWalletReturnValue(helper.guardian.uid, {
      token: helper.token.uid,
      network: helper.network,
    });
    await expectThrow(
      testEnv.wrap<Transaction>(WEN_FUNC.mintTokenOrder),
      WenError.token_in_invalid_status.key,
    );
  });

  it('Should credit, already minted', async () => {
    await helper.setup();
    mockWalletReturnValue(helper.guardian.uid, {
      token: helper.token.uid,
      network: helper.network,
    });
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.mintTokenOrder);
    const order2 = await testEnv.wrap<Transaction>(WEN_FUNC.mintTokenOrder);

    await requestFundsFromFaucet(helper.network, order.payload.targetAddress, order.payload.amount);
    await requestFundsFromFaucet(
      helper.network,
      order2.payload.targetAddress,
      order2.payload.amount,
    );

    const tokenDocRef = build5Db().doc(COL.TOKEN, helper.token.uid);
    await wait(async () => {
      const snap = await tokenDocRef.get();
      return snap?.status === TokenStatus.MINTED;
    });
    await wait(async () => {
      const snap = await build5Db()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT)
        .where('member', '==', helper.guardian.uid)
        .get();
      return snap.length > 0;
    });
    await awaitTransactionConfirmationsForToken(helper.token.uid);
  });
});
