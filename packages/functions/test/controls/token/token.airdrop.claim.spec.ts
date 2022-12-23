import {
  COL,
  Space,
  SUB_COL,
  Token,
  TokenAllocation,
  TokenDrop,
  TokenDropStatus,
  TokenStatus,
  Transaction,
  TransactionOrderType,
  TransactionType,
  WenError,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../../../src/admin.config';
import { airdropToken, claimAirdroppedToken } from '../../../src/controls/token-airdrop.control';
import { createToken } from '../../../src/controls/token.control';
import * as wallet from '../../../src/utils/wallet.utils';
import { MEDIA, testEnv } from '../../set-up';
import {
  createMember,
  createSpace,
  expectThrow,
  getRandomSymbol,
  milestoneProcessed,
  mockWalletReturnValue,
  submitMilestoneFunc,
  wait,
} from '../common';

let walletSpy: any;

const dummyToken = (space: string) =>
  ({
    name: 'MyToken',
    symbol: getRandomSymbol(),
    space,
    totalSupply: 1000,
    allocations: <TokenAllocation[]>[{ title: 'Allocation1', percentage: 100 }],
    icon: MEDIA,
    overviewGraphics: MEDIA,
    termsAndConditions: 'https://wen.soonaverse.com/token/terms-and-conditions',
    access: 0,
  } as any);

const waitAllClaimed = (token: string, claimExpected?: number) =>
  wait(async () => {
    const airdrops = await getAirdropsForToken(token);
    const claimed = airdrops.filter((a) => a.status === TokenDropStatus.CLAIMED).length;
    return claimed === (claimExpected || airdrops.length);
  });

describe('Claim airdropped token test', () => {
  let guardian: string;
  let space: Space;
  let token: Token;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    guardian = await createMember(walletSpy);
    space = await createSpace(walletSpy, guardian);
    const dummyTokenData = dummyToken(space.uid);
    dummyTokenData.saleStartDate = dayjs().add(8, 'day').toDate();
    dummyTokenData.saleLength = 86400000;
    dummyTokenData.coolDownLength = 86400000;
    dummyTokenData.allocations = [
      { title: 'Private', percentage: 90 },
      { title: 'Public', percentage: 10, isPublicSale: true },
    ];
    mockWalletReturnValue(walletSpy, guardian, dummyTokenData);
    token = await testEnv.wrap(createToken)({});
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ approved: true });
  });

  const airdrop = async () => {
    const airdropRequest = {
      token: token.uid,
      drops: [{ count: 450, recipient: guardian, vestingAt: dayjs().toDate() }],
    };
    mockWalletReturnValue(walletSpy, guardian, airdropRequest);
    await testEnv.wrap(airdropToken)({});
  };

  it('Should claim token', async () => {
    await airdrop();
    mockWalletReturnValue(walletSpy, guardian, { token: token.uid });
    const order = await testEnv.wrap(claimAirdroppedToken)({});
    const nextMilestone = await submitMilestoneFunc(
      order.payload.targetAddress,
      order.payload.amount,
    );
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    const orderTran = <Transaction>(
      (await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).get()).data()
    );
    expect(orderTran.member).toBe(guardian);
    expect(orderTran.payload.type).toBe(TransactionOrderType.TOKEN_AIRDROP);

    await waitAllClaimed(token.uid);

    const paymentsSnap = await admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('payload.sourceTransaction', 'array-contains', orderTran.uid)
      .get();
    const types = paymentsSnap.docs.map((d) => d.data().type).sort();
    expect(types).toEqual([TransactionType.BILL_PAYMENT, TransactionType.PAYMENT]);

    const distirbutionDocRef = admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardian}`);
    const distribution = (await distirbutionDocRef.get()).data();
    expect(distribution?.tokenClaimed).toBe(450);
    expect(distribution?.tokenOwned).toBe(450);

    const airdrops = await getAirdropsForToken(token.uid);
    expect(airdrops.length).toBe(1);
    expect(airdrops[0].status).toBe(TokenDropStatus.CLAIMED);
  });

  it('Should claim multiple drops token', async () => {
    await airdrop();
    await airdrop();

    mockWalletReturnValue(walletSpy, guardian, { token: token.uid });
    const order = await testEnv.wrap(claimAirdroppedToken)({});
    const nextMilestone = await submitMilestoneFunc(
      order.payload.targetAddress,
      order.payload.amount,
    );
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    const orderTran = <Transaction>(
      (await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).get()).data()
    );
    expect(orderTran.member).toBe(guardian);
    expect(orderTran.payload.type).toBe(TransactionOrderType.TOKEN_AIRDROP);

    await waitAllClaimed(token.uid);

    const paymentsSnap = await admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('payload.sourceTransaction', 'array-contains', orderTran.uid)
      .get();
    const types = paymentsSnap.docs.map((d) => d.data().type).sort();
    expect(types).toEqual([
      TransactionType.BILL_PAYMENT,
      TransactionType.BILL_PAYMENT,
      TransactionType.PAYMENT,
    ]);

    const distirbutionDocRef = admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardian}`);
    const distribution = (await distirbutionDocRef.get()).data();
    expect(distribution?.tokenClaimed).toBe(900);
    expect(distribution?.tokenOwned).toBe(900);

    const airdrops = await getAirdropsForToken(token.uid);
    expect(airdrops.length).toBe(2);
    expect(airdrops[0].status).toBe(TokenDropStatus.CLAIMED);
    expect(airdrops[1].status).toBe(TokenDropStatus.CLAIMED);
  });

  it('Should claim only vested drops', async () => {
    await airdrop();
    const airdropRequest = {
      token: token.uid,
      drops: [{ count: 450, recipient: guardian, vestingAt: dayjs().add(1, 'd').toDate() }],
    };
    mockWalletReturnValue(walletSpy, guardian, airdropRequest);
    await testEnv.wrap(airdropToken)({});

    mockWalletReturnValue(walletSpy, guardian, { token: token.uid });
    const order = await testEnv.wrap(claimAirdroppedToken)({});
    const nextMilestone = await submitMilestoneFunc(
      order.payload.targetAddress,
      order.payload.amount,
    );
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    const orderTran = <Transaction>(
      (await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).get()).data()
    );
    expect(orderTran.member).toBe(guardian);
    expect(orderTran.payload.type).toBe(TransactionOrderType.TOKEN_AIRDROP);
    await waitAllClaimed(token.uid, 1);

    const paymentsSnap = await admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('payload.sourceTransaction', 'array-contains', orderTran.uid)
      .get();
    const types = paymentsSnap.docs.map((d) => d.data().type).sort();
    expect(types).toEqual([TransactionType.BILL_PAYMENT, TransactionType.PAYMENT]);

    const distirbutionDocRef = admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardian}`);
    const distribution = (await distirbutionDocRef.get()).data();
    expect(distribution?.tokenClaimed).toBe(450);
    expect(distribution?.tokenOwned).toBe(450);
  });

  it('Should claim same in parallel', async () => {
    await airdrop();
    mockWalletReturnValue(walletSpy, guardian, { token: token.uid });
    const claimToken = async () => {
      const order = await testEnv.wrap(claimAirdroppedToken)({});
      await new Promise((r) => setTimeout(r, 1000));
      const nextMilestone = await submitMilestoneFunc(
        order.payload.targetAddress,
        order.payload.amount,
      );
      await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);
      return order;
    };
    const promises = [claimToken(), claimToken()];
    await Promise.all(promises);
    await waitAllClaimed(token.uid);

    const distirbutionDocRef = admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardian}`);
    const distribution = (await distirbutionDocRef.get()).data();
    expect(distribution?.tokenClaimed).toBe(450);
    expect(distribution?.tokenOwned).toBe(450);

    const creditSnap = await admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('member', '==', guardian)
      .where('type', '==', TransactionType.CREDIT)
      .where('payload.token', '==', token.uid)
      .get();
    expect(creditSnap.size).toBe(2);

    const billPaymentSnap = await admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('member', '==', guardian)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('payload.token', '==', token.uid)
      .get();
    expect(billPaymentSnap.size).toBe(1);
  });

  it('Should throw, token is minted', async () => {
    mockWalletReturnValue(walletSpy, guardian, { token: token.uid });
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ status: TokenStatus.MINTED });
    await expectThrow(testEnv.wrap(claimAirdroppedToken)({}), WenError.token_in_invalid_status.key);
  });

  it('Should claim 700', async () => {
    const airdropRequest = {
      token: token.uid,
      drops: Array.from(Array(900)).map((_, i) => ({
        count: 1,
        recipient: guardian,
        vestingAt: dayjs()
          .add(i > 699 ? 1 : 0, 'd')
          .toDate(),
      })),
    };
    mockWalletReturnValue(walletSpy, guardian, airdropRequest);
    await testEnv.wrap(airdropToken)({});

    mockWalletReturnValue(walletSpy, guardian, { token: token.uid });
    const order = await testEnv.wrap(claimAirdroppedToken)({});
    const nextMilestone = await submitMilestoneFunc(
      order.payload.targetAddress,
      order.payload.amount,
    );
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    const orderTran = <Transaction>(
      (await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).get()).data()
    );
    expect(orderTran.member).toBe(guardian);
    expect(orderTran.payload.type).toBe(TransactionOrderType.TOKEN_AIRDROP);
    await waitAllClaimed(token.uid, 700);
  });
});

const getAirdropsForToken = async (token: string) => {
  const snap = await admin.firestore().collection(COL.AIRDROP).where('token', '==', token).get();
  return snap.docs.map((d) => d.data() as TokenDrop);
};