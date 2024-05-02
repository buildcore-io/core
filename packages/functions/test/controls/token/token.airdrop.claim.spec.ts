import { database } from '@buildcore/database';
import {
  Access,
  COL,
  SUB_COL,
  Space,
  Token,
  TokenAllocation,
  TokenDrop,
  TokenDropStatus,
  TokenStatus,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  WEN_FUNC,
  WenError,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { MEDIA, mockWalletReturnValue, testEnv } from '../../set-up';
import { expectThrow, getRandomSymbol, submitMilestoneFunc, wait } from '../common';

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
    access: Access.OPEN,
    decimals: 6,
  }) as any;

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
    guardian = await testEnv.createMember();
    space = await testEnv.createSpace(guardian);
    const dummyTokenData = dummyToken(space.uid);
    dummyTokenData.saleStartDate = dayjs().add(8, 'day').toDate();
    dummyTokenData.saleLength = 86400000;
    dummyTokenData.coolDownLength = 86400000;
    dummyTokenData.allocations = [
      { title: 'Private', percentage: 90 },
      { title: 'Public', percentage: 10, isPublicSale: true },
    ];
    mockWalletReturnValue(guardian, dummyTokenData);
    token = await testEnv.wrap<Token>(WEN_FUNC.createToken);
    await database().doc(COL.TOKEN, token.uid).update({ approved: true });
  });

  const airdrop = async () => {
    const airdropRequest = {
      token: token.uid,
      drops: [{ count: 450, recipient: guardian, vestingAt: dayjs().toDate() }],
    };
    mockWalletReturnValue(guardian, airdropRequest);
    await testEnv.wrap(WEN_FUNC.airdropToken);
  };

  it('Should claim token', async () => {
    await airdrop();
    mockWalletReturnValue(guardian, { token: token.uid });
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.claimAirdroppedToken);
    await submitMilestoneFunc(order);

    const orderTran = <Transaction>await database().doc(COL.TRANSACTION, order.uid).get();
    expect(orderTran.member).toBe(guardian);
    expect(orderTran.payload.type).toBe(TransactionPayloadType.TOKEN_AIRDROP);

    await waitAllClaimed(token.uid);

    const paymentsSnap = await database()
      .collection(COL.TRANSACTION)
      .where('payload_sourceTransaction', 'array-contains', orderTran.uid! as any)
      .get();
    const types = paymentsSnap.map((d) => d.type).sort();
    expect(types).toEqual([TransactionType.BILL_PAYMENT, TransactionType.PAYMENT]);

    const distirbutionDocRef = database().doc(COL.TOKEN, token.uid, SUB_COL.DISTRIBUTION, guardian);
    const distribution = await distirbutionDocRef.get();
    expect(distribution?.tokenClaimed).toBe(450);
    expect(distribution?.tokenOwned).toBe(450);

    const airdrops = await getAirdropsForToken(token.uid);
    expect(airdrops.length).toBe(1);
    expect(airdrops[0].status).toBe(TokenDropStatus.CLAIMED);
  });

  it('Should claim multiple drops token', async () => {
    await airdrop();
    await airdrop();
    mockWalletReturnValue(guardian, { token: token.uid });
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.claimAirdroppedToken);
    await submitMilestoneFunc(order);

    const orderTran = <Transaction>await database().doc(COL.TRANSACTION, order.uid).get();
    expect(orderTran.member).toBe(guardian);
    expect(orderTran.payload.type).toBe(TransactionPayloadType.TOKEN_AIRDROP);

    await waitAllClaimed(token.uid);

    const paymentsSnap = await database()
      .collection(COL.TRANSACTION)
      .where('payload_sourceTransaction', 'array-contains', orderTran.uid as any)
      .get();
    const types = paymentsSnap.map((d) => d.type).sort();
    expect(types).toEqual([
      TransactionType.BILL_PAYMENT,
      TransactionType.BILL_PAYMENT,
      TransactionType.PAYMENT,
    ]);
    const distirbutionDocRef = database().doc(COL.TOKEN, token.uid, SUB_COL.DISTRIBUTION, guardian);
    const distribution = await distirbutionDocRef.get();
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
    mockWalletReturnValue(guardian, airdropRequest);
    await testEnv.wrap(WEN_FUNC.airdropToken);
    mockWalletReturnValue(guardian, { token: token.uid });
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.claimAirdroppedToken);
    await submitMilestoneFunc(order);
    const orderTran = <Transaction>await database().doc(COL.TRANSACTION, order.uid).get();
    expect(orderTran.member).toBe(guardian);
    expect(orderTran.payload.type).toBe(TransactionPayloadType.TOKEN_AIRDROP);
    await waitAllClaimed(token.uid, 1);
    const paymentsSnap = await database()
      .collection(COL.TRANSACTION)
      .where('payload_sourceTransaction', 'array-contains', orderTran.uid as any)
      .get();
    const types = paymentsSnap.map((d) => d.type).sort();
    expect(types).toEqual([TransactionType.BILL_PAYMENT, TransactionType.PAYMENT]);
    const distirbutionDocRef = database().doc(COL.TOKEN, token.uid, SUB_COL.DISTRIBUTION, guardian);
    const distribution = await distirbutionDocRef.get();
    expect(distribution?.tokenClaimed).toBe(450);
    expect(distribution?.tokenOwned).toBe(450);
  });

  it('Should claim same in parallel', async () => {
    await airdrop();
    const claimToken = async () => {
      mockWalletReturnValue(guardian, { token: token.uid });
      const order = await testEnv.wrap<Transaction>(WEN_FUNC.claimAirdroppedToken);
      await new Promise((r) => setTimeout(r, 1000));
      await submitMilestoneFunc(order);
      return order;
    };
    const promises = [claimToken(), claimToken()];
    await Promise.all(promises);
    await waitAllClaimed(token.uid);
    const distirbutionDocRef = database().doc(COL.TOKEN, token.uid, SUB_COL.DISTRIBUTION, guardian);
    const distribution = await distirbutionDocRef.get();
    expect(distribution?.tokenClaimed).toBe(450);
    expect(distribution?.tokenOwned).toBe(450);
    const creditSnap = await database()
      .collection(COL.TRANSACTION)
      .where('member', '==', guardian)
      .where('type', '==', TransactionType.CREDIT)
      .where('payload_token', '==', token.uid)
      .get();
    expect(creditSnap.length).toBe(2);
    const billPaymentSnap = await database()
      .collection(COL.TRANSACTION)
      .where('member', '==', guardian)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('payload_token', '==', token.uid)
      .get();
    expect(billPaymentSnap.length).toBe(1);
    const billPayment = billPaymentSnap[0]!;
    expect(billPayment.payload.token).toBe(token.uid);
    expect(billPayment.payload.tokenSymbol).toBe(token.symbol);
    expect(billPayment.payload.type).toBe(TransactionPayloadType.PRE_MINTED_AIRDROP_CLAIM);
  });

  it('Should throw, token is minted', async () => {
    await database().doc(COL.TOKEN, token.uid).update({ status: TokenStatus.MINTED });
    mockWalletReturnValue(guardian, { token: token.uid });
    await expectThrow(
      testEnv.wrap(WEN_FUNC.claimAirdroppedToken),
      WenError.token_in_invalid_status.key,
    );
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
    mockWalletReturnValue(guardian, airdropRequest);
    await testEnv.wrap(WEN_FUNC.airdropToken);
    mockWalletReturnValue(guardian, { token: token.uid });
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.claimAirdroppedToken);
    await submitMilestoneFunc(order);
    const orderTran = <Transaction>await database().doc(COL.TRANSACTION, order.uid).get();
    expect(orderTran.member).toBe(guardian);
    expect(orderTran.payload.type).toBe(TransactionPayloadType.TOKEN_AIRDROP);
    await waitAllClaimed(token.uid, 700);
  });
});

const getAirdropsForToken = async (token: string) => {
  const snap = await database().collection(COL.AIRDROP).where('token', '==', token).get();
  return snap.map((d) => d as TokenDrop);
};
