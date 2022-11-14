import { addressBalance } from '@iota/iota.js-next';
import {
  COL,
  Member,
  MIN_IOTA_AMOUNT,
  Spdr,
  SpdrStatus,
  StakeType,
  SUB_COL,
  TokenDistribution,
  TransactionType,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import admin from '../../src/admin.config';
import { claimMintedTokenOrder } from '../../src/controls/token-minting/claim-minted-token.control';
import { spdrCronTask } from '../../src/cron/spdr.cron';
import { retryWallet } from '../../src/cron/wallet.cron';
import { getAddress } from '../../src/utils/address.utils';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { createMember, mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { awaitTransactionConfirmationsForToken } from '../common';
import { requestFundsFromFaucet, requestMintedTokenFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('SPDR test', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
    await admin.firestore().doc(`${COL.TOKEN}/${helper.token!.uid}`).update({ symbol: 'SOON' });
  });

  const verifyMemberAirdrop = async (member: string, count: number) => {
    const docRef = admin
      .firestore()
      .doc(`${COL.TOKEN}/${helper.token!.uid}/${SUB_COL.DISTRIBUTION}/${member}`);
    await wait(async () => {
      const doc = await docRef.get();
      return !isEmpty(doc.data()?.tokenDrops);
    });
    const distribution = <TokenDistribution>(await docRef.get()).data();
    expect(distribution.tokenDrops!.length).toBe(1);
    expect(distribution.tokenDrops![0].sourceAddress).toBe(helper.space?.vaultAddress);
    expect(distribution.tokenDrops![0].count).toBe(count);
    expect(
      dayjs().add(1, 'y').subtract(5, 'm').isBefore(distribution.tokenDrops![0].vestingAt.toDate()),
    ).toBe(true);
  };

  it('Should create reward airdrops for two', async () => {
    await requestMintedTokenFromFaucet(
      helper.walletService!,
      helper.memberAddress!,
      helper.TOKEN_ID,
      helper.VAULT_MNEMONIC,
      1000,
    );
    await helper.stakeAmount(1000, 26);
    await helper.validateStatsStakeAmount(1000, 1000, 1500, 1500, StakeType.DYNAMIC);

    const member2Uid = await createMember(helper.walletSpy);
    const member2 = <Member>(
      (await admin.firestore().doc(`${COL.MEMBER}/${member2Uid}`).get()).data()
    );
    const member2Address = await helper.walletService?.getAddressDetails(
      getAddress(member2, helper.network)!,
    )!;
    await requestFundsFromFaucet(helper.network, member2Address.bech32, 10 * MIN_IOTA_AMOUNT);
    await requestMintedTokenFromFaucet(
      helper.walletService!,
      member2Address,
      helper.TOKEN_ID,
      helper.VAULT_MNEMONIC,
      500,
    );
    await helper.stakeAmount(500, 26, undefined, undefined, undefined, member2Uid);
    await helper.validateStatsStakeAmount(1500, 1500, 2250, 2250, StakeType.DYNAMIC);

    let spdr = <Spdr>{
      uid: getRandomEthAddress(),
      startDate: dateToTimestamp(dayjs().subtract(1, 'h')),
      endDate: dateToTimestamp(dayjs()),
      tokenVestingDate: dateToTimestamp(dayjs().add(1, 'y')),

      tokensToDistribute: 9538831184,
      token: helper.token?.uid!,
      status: SpdrStatus.UNPROCESSED,
    };
    const spdrDocRef = admin.firestore().doc(`${COL.SPDR}/${spdr.uid}`);
    await spdrDocRef.create(spdr);
    await spdrCronTask();

    await verifyMemberAirdrop(helper.member!.uid, 6359220790);
    await verifyMemberAirdrop(member2Uid, 3179610394);

    await wait(async () => {
      const spdr = <Spdr>(await spdrDocRef.get()).data();
      return spdr.status === SpdrStatus.PROCESSED;
    });

    spdr = <Spdr>(await spdrDocRef.get()).data();
    expect(spdr.totalStaked).toBe(1500);
    expect(spdr.totalAirdropped).toBe(9538831184);
  });

  it('Should create reward airdrops and claim it', async () => {
    const vaultAddress = await helper.walletService!.getAddressDetails(helper.space?.vaultAddress!);
    await requestFundsFromFaucet(helper.network, vaultAddress.bech32, MIN_IOTA_AMOUNT);
    await requestMintedTokenFromFaucet(
      helper.walletService!,
      vaultAddress,
      helper.TOKEN_ID,
      helper.VAULT_MNEMONIC,
      100,
    );

    await helper.stakeAmount(100, 26);
    const spdr = <Spdr>{
      uid: getRandomEthAddress(),
      startDate: dateToTimestamp(dayjs().subtract(1, 'h')),
      endDate: dateToTimestamp(dayjs()),
      tokenVestingDate: dateToTimestamp(dayjs().add(1, 'y')),

      tokensToDistribute: 100,
      token: helper.token?.uid!,
      status: SpdrStatus.UNPROCESSED,
    };
    const spdrDocRef = admin.firestore().doc(`${COL.SPDR}/${spdr.uid}`);
    await spdrDocRef.create(spdr);
    await spdrCronTask();

    await verifyMemberAirdrop(helper.member!.uid, 100);

    mockWalletReturnValue(helper.walletSpy, helper.member!.uid, {
      token: helper.token!.uid,
    });
    const claimOrder = await testEnv.wrap(claimMintedTokenOrder)({});
    await requestFundsFromFaucet(
      helper.network,
      claimOrder.payload.targetAddress,
      claimOrder.payload.amount,
    );

    await wait(async () => {
      const snap = await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('member', '==', helper.member!.uid)
        .where('type', '==', TransactionType.BILL_PAYMENT)
        .get();
      return snap.size === 2;
    });

    await awaitTransactionConfirmationsForToken(helper.token?.uid!);
    const outputs = await helper.walletService!.getOutputs(
      helper.memberAddress!.bech32,
      [],
      false,
      true,
    );

    expect(
      Object.values(outputs).reduce((acc, act) => acc + Number(act.nativeTokens![0].amount), 0),
    ).toBe(200);
  });

  it('Should fail first then proceed, not enough balance', async () => {
    await helper.stakeAmount(100, 26);

    const spdr = <Spdr>{
      uid: getRandomEthAddress(),
      startDate: dateToTimestamp(dayjs().subtract(1, 'h')),
      endDate: dateToTimestamp(dayjs()),
      tokenVestingDate: dateToTimestamp(dayjs().add(1, 'y')),

      tokensToDistribute: 100,
      token: helper.token?.uid!,
      status: SpdrStatus.UNPROCESSED,
    };
    const spdrDocRef = admin.firestore().doc(`${COL.SPDR}/${spdr.uid}`);
    await spdrDocRef.create(spdr);
    await spdrCronTask();

    await verifyMemberAirdrop(helper.member!.uid, 100);

    mockWalletReturnValue(helper.walletSpy, helper.member!.uid, {
      token: helper.token!.uid,
    });
    const claimOrder = await testEnv.wrap(claimMintedTokenOrder)({});
    await requestFundsFromFaucet(
      helper.network,
      claimOrder.payload.targetAddress,
      claimOrder.payload.amount,
    );

    const query = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.member!.uid)
      .where('type', '==', TransactionType.BILL_PAYMENT);
    let failed: any;
    await wait(async () => {
      const snap = await query.get();
      failed = snap.docs.find((d) => d.data()?.payload?.walletReference?.count === 5);
      return snap.size === 2 && failed !== undefined;
    });
    const vaultAddress = await helper.walletService!.getAddressDetails(helper.space?.vaultAddress!);
    await requestFundsFromFaucet(helper.network, vaultAddress.bech32, MIN_IOTA_AMOUNT);
    await requestMintedTokenFromFaucet(
      helper.walletService!,
      vaultAddress,
      helper.TOKEN_ID,
      helper.VAULT_MNEMONIC,
      100,
    );

    await wait(async () => {
      const balance = await addressBalance(
        helper.walletService!.client,
        helper.space!.vaultAddress!,
      );
      return !isEmpty(balance.nativeTokens);
    });

    if (failed) {
      await failed.ref.update({
        'payload.walletReference.count': 4,
        'payload.walletReference.processedOn': dateToTimestamp(dayjs().subtract(1, 'h')),
      });
    }
    await retryWallet();

    await awaitTransactionConfirmationsForToken(helper.token?.uid!);
    const outputs = await helper.walletService!.getOutputs(
      helper.memberAddress!.bech32,
      [],
      false,
      true,
    );

    expect(
      Object.values(outputs).reduce((acc, act) => acc + Number(act.nativeTokens![0].amount), 0),
    ).toBe(200);
  });

  it('Should only pick stakes for the given period', async () => {
    const vaultAddress = await helper.walletService!.getAddressDetails(helper.space?.vaultAddress!);
    await requestFundsFromFaucet(helper.network, vaultAddress.bech32, MIN_IOTA_AMOUNT);
    await requestMintedTokenFromFaucet(
      helper.walletService!,
      vaultAddress,
      helper.TOKEN_ID,
      helper.VAULT_MNEMONIC,
      100,
    );

    await helper.stakeAmount(50, 26);
    const stake = await helper.stakeAmount(50, 26);
    await admin
      .firestore()
      .doc(`${COL.STAKE}/${stake.uid}`)
      .update({
        createdOn: dateToTimestamp(dayjs().subtract(1, 'h')),
      });

    let spdr = <Spdr>{
      uid: getRandomEthAddress(),
      startDate: dateToTimestamp(dayjs().subtract(1, 'h')),
      endDate: dateToTimestamp(dayjs()),
      tokenVestingDate: dateToTimestamp(dayjs().add(1, 'y')),

      tokensToDistribute: 50,
      token: helper.token?.uid!,
      status: SpdrStatus.UNPROCESSED,
    };
    const spdrDocRef = admin.firestore().doc(`${COL.SPDR}/${spdr.uid}`);
    await spdrDocRef.create(spdr);
    await spdrCronTask();

    await wait(async () => {
      const spdr = <Spdr>(await spdrDocRef.get()).data();
      return spdr.status === SpdrStatus.PROCESSED;
    });

    spdr = <Spdr>(await spdrDocRef.get()).data();
    expect(spdr.totalStaked).toBe(50);
    expect(spdr.totalAirdropped).toBe(50);
  });
});
