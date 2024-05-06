import { database } from '@buildcore/database';
import {
  Award,
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  Space,
  Token,
  TokenDropStatus,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  WEN_FUNC,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { Wallet } from '../../src/services/wallet/wallet';
import { wait } from '../../test/controls/common';
import { MEDIA, getWallet, mockWalletReturnValue, testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { saveBaseToken } from './common';

const network = Network.RMS;

describe('Award', () => {
  let guardian: string;
  let space: Space;
  let award: Award;
  let token: Token;
  let walletService: Wallet;

  beforeAll(async () => {
    walletService = await getWallet(network);
  });

  beforeEach(async () => {
    guardian = await testEnv.createMember();
    space = await testEnv.createSpace(guardian);

    token = await saveBaseToken(space.uid, guardian, network);

    mockWalletReturnValue(guardian, awardRequest(space.uid, token.symbol));
    award = await testEnv.wrap(WEN_FUNC.createAward);
  });

  it('Should issue many awards', async () => {
    mockWalletReturnValue(guardian, { uid: award.uid });
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.fundAward);
    await requestFundsFromFaucet(network, order.payload.targetAddress, order.payload.amount);

    const awardDocRef = database().doc(COL.AWARD, award.uid);
    await wait(async () => {
      const award = <Award>await awardDocRef.get();
      return award.approved && award.funded;
    });

    const tmp = await testEnv.createMember();
    await database().doc(COL.MEMBER, tmp).update({ rmsAddress: '' });
    mockWalletReturnValue(guardian, {
      award: award.uid,
      members: [tmp, tmp],
    });
    await testEnv.wrap(WEN_FUNC.approveParticipantAward);

    const tmpAddress = await walletService.getNewIotaAddressDetails();
    mockWalletReturnValue(tmp, { network: Network.RMS });
    const addressValidationOrder = await testEnv.wrap<Transaction>(WEN_FUNC.validateAddress);
    await requestFundsFromFaucet(
      Network.RMS,
      tmpAddress.bech32,
      addressValidationOrder.payload.amount,
    );
    await walletService.send(
      tmpAddress,
      addressValidationOrder.payload.targetAddress!,
      addressValidationOrder.payload.amount!,
      {},
    );

    await wait(async () => {
      const response = await walletService.client.nftOutputIds([{ address: tmpAddress.bech32 }]);
      return response.items.length === 2;
    });

    const airdropQuery = database().collection(COL.AIRDROP).where('member', '==', tmp);
    let airdropSnap = await airdropQuery.get();
    expect(airdropSnap.length).toBe(2);

    mockWalletReturnValue(tmp, { symbol: token.symbol });
    const claimOrder = await testEnv.wrap<Transaction>(WEN_FUNC.claimMintedTokenOrder);
    await requestFundsFromFaucet(
      network,
      claimOrder.payload.targetAddress,
      claimOrder.payload.amount,
    );
    await wait(async () => {
      airdropSnap = await airdropQuery.get();
      const allClaimed = airdropSnap.reduce(
        (acc, doc) => acc && doc.status === TokenDropStatus.CLAIMED,
        true,
      );
      return allClaimed;
    });

    await wait(async () => {
      const { amount } = await walletService.getBalance(tmpAddress.bech32);
      return (
        amount ===
        2 * MIN_IOTA_AMOUNT + claimOrder.payload.amount! + addressValidationOrder.payload.amount!
      );
    });

    const billPaymentQuery = database()
      .collection(COL.TRANSACTION)
      .where('member', '==', tmp)
      .where('type', '==', TransactionType.BILL_PAYMENT);
    const billPayments = (await billPaymentQuery.get()).map((d) => d as Transaction);
    billPayments.forEach((billPayment) => {
      expect(billPayment.payload.token).toBe(token.uid);
      expect(billPayment.payload.tokenSymbol).toBe(token.symbol);
      expect(billPayment.payload.type).toBe(TransactionPayloadType.BASE_AIRDROP_CLAIM);
    });
  });
});

const awardRequest = (space: string, tokenSymbol: string) => ({
  name: 'award',
  description: 'award',
  space,
  endDate: dayjs().add(2, 'd').toDate(),
  badge: {
    name: 'badge',
    description: 'badge',
    total: 2,
    image: MEDIA,
    tokenReward: MIN_IOTA_AMOUNT,
    lockTime: 31557600000,
    tokenSymbol,
  },
  network,
});
