import {
  BillPaymentType,
  COL,
  Space,
  SUB_COL,
  Token,
  TokenAllocation,
  TokenDistribution,
  TokenDrop,
  TokenDropStatus,
  TokenStatus,
  Transaction,
  TransactionOrderType,
  TransactionType,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { soonDb } from '../../../src/firebase/firestore/soondb';
import {
  airdropToken,
  claimAirdroppedToken,
  createToken,
} from '../../../src/runtime/firebase/token/base';
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
    decimals: 6,
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
    await soonDb().doc(`${COL.TOKEN}/${token.uid}`).update({ approved: true });
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

    const orderTran = <Transaction>await soonDb().doc(`${COL.TRANSACTION}/${order.uid}`).get();
    expect(orderTran.member).toBe(guardian);
    expect(orderTran.payload.type).toBe(TransactionOrderType.TOKEN_AIRDROP);

    await waitAllClaimed(token.uid);

    const paymentsSnap = await soonDb()
      .collection(COL.TRANSACTION)
      .where('payload.sourceTransaction', 'array-contains', orderTran.uid)
      .get<Transaction>();
    const types = paymentsSnap.map((d) => d.type).sort();
    expect(types).toEqual([TransactionType.BILL_PAYMENT, TransactionType.PAYMENT]);

    const distirbutionDocRef = soonDb().doc(
      `${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardian}`,
    );
    const distribution = await distirbutionDocRef.get<TokenDistribution>();
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

    const orderTran = <Transaction>await soonDb().doc(`${COL.TRANSACTION}/${order.uid}`).get();
    expect(orderTran.member).toBe(guardian);
    expect(orderTran.payload.type).toBe(TransactionOrderType.TOKEN_AIRDROP);

    await waitAllClaimed(token.uid);

    const paymentsSnap = await soonDb()
      .collection(COL.TRANSACTION)
      .where('payload.sourceTransaction', 'array-contains', orderTran.uid)
      .get<Transaction>();
    const types = paymentsSnap.map((d) => d.type).sort();
    expect(types).toEqual([
      TransactionType.BILL_PAYMENT,
      TransactionType.BILL_PAYMENT,
      TransactionType.PAYMENT,
    ]);

    const distirbutionDocRef = soonDb().doc(
      `${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardian}`,
    );
    const distribution = await distirbutionDocRef.get<TokenDistribution>();
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

    const orderTran = <Transaction>await soonDb().doc(`${COL.TRANSACTION}/${order.uid}`).get();
    expect(orderTran.member).toBe(guardian);
    expect(orderTran.payload.type).toBe(TransactionOrderType.TOKEN_AIRDROP);
    await waitAllClaimed(token.uid, 1);

    const paymentsSnap = await soonDb()
      .collection(COL.TRANSACTION)
      .where('payload.sourceTransaction', 'array-contains', orderTran.uid)
      .get<Transaction>();
    const types = paymentsSnap.map((d) => d.type).sort();
    expect(types).toEqual([TransactionType.BILL_PAYMENT, TransactionType.PAYMENT]);

    const distirbutionDocRef = soonDb().doc(
      `${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardian}`,
    );
    const distribution = await distirbutionDocRef.get<TokenDistribution>();
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

    const distirbutionDocRef = soonDb().doc(
      `${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardian}`,
    );
    const distribution = await distirbutionDocRef.get<TokenDistribution>();
    expect(distribution?.tokenClaimed).toBe(450);
    expect(distribution?.tokenOwned).toBe(450);

    const creditSnap = await soonDb()
      .collection(COL.TRANSACTION)
      .where('member', '==', guardian)
      .where('type', '==', TransactionType.CREDIT)
      .where('payload.token', '==', token.uid)
      .get();
    expect(creditSnap.length).toBe(2);

    const billPaymentSnap = await soonDb()
      .collection(COL.TRANSACTION)
      .where('member', '==', guardian)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('payload.token', '==', token.uid)
      .get<Transaction>();
    expect(billPaymentSnap.length).toBe(1);
    const billPayment = billPaymentSnap[0]!;
    expect(billPayment.payload.token).toBe(token.uid);
    expect(billPayment.payload.tokenSymbol).toBe(token.symbol);
    expect(billPayment.payload.type).toBe(BillPaymentType.PRE_MINTED_AIRDROP_CLAIM);
  });

  it('Should throw, token is minted', async () => {
    mockWalletReturnValue(walletSpy, guardian, { token: token.uid });
    await soonDb().doc(`${COL.TOKEN}/${token.uid}`).update({ status: TokenStatus.MINTED });
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

    const orderTran = <Transaction>await soonDb().doc(`${COL.TRANSACTION}/${order.uid}`).get();
    expect(orderTran.member).toBe(guardian);
    expect(orderTran.payload.type).toBe(TransactionOrderType.TOKEN_AIRDROP);
    await waitAllClaimed(token.uid, 700);
  });
});

const getAirdropsForToken = async (token: string) => {
  const snap = await soonDb().collection(COL.AIRDROP).where('token', '==', token).get();
  return snap.map((d) => d as TokenDrop);
};
