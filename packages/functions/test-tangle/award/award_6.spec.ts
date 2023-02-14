import { IndexerPluginClient } from '@iota/iota.js-next';
import {
  Award,
  BillPaymentType,
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  Space,
  Token,
  TokenDropStatus,
  Transaction,
  TransactionType,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../../src/admin.config';
import { validateAddress } from '../../src/controls/address.control';
import { claimMintedTokenOrder } from '../../src/controls/token-minting/claim-minted-token.control';
import { approveAwardParticipant, createAward, fundAward } from '../../src/runtime/firebase/award';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { WalletService } from '../../src/services/wallet/wallet';
import * as wallet from '../../src/utils/wallet.utils';
import { createMember, createSpace, mockWalletReturnValue, wait } from '../../test/controls/common';
import { MEDIA, testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { saveBaseToken } from './common';

const network = Network.RMS;
let walletSpy: any;

describe('Award', () => {
  let guardian: string;
  let space: Space;
  let award: Award;
  let token: Token;
  let walletService: SmrWallet;

  beforeAll(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    walletService = (await WalletService.newWallet(network)) as SmrWallet;
  });

  beforeEach(async () => {
    guardian = await createMember(walletSpy);
    space = await createSpace(walletSpy, guardian);

    token = await saveBaseToken(space.uid, guardian);

    mockWalletReturnValue(walletSpy, guardian, awardRequest(space.uid, token.symbol));
    award = await testEnv.wrap(createAward)({});
  });

  it('Should issue many awards', async () => {
    mockWalletReturnValue(walletSpy, guardian, { uid: award.uid });
    const order = await testEnv.wrap(fundAward)({});
    await requestFundsFromFaucet(network, order.payload.targetAddress, order.payload.amount);

    const awardDocRef = admin.firestore().doc(`${COL.AWARD}/${award.uid}`);
    await wait(async () => {
      const award = <Award>(await awardDocRef.get()).data();
      return award.approved && award.funded;
    });

    const tmp = wallet.getRandomEthAddress();
    mockWalletReturnValue(walletSpy, guardian, {
      award: award.uid,
      members: [tmp, tmp],
    });
    await testEnv.wrap(approveAwardParticipant)({});

    const tmpAddress = await walletService.getNewIotaAddressDetails();
    mockWalletReturnValue(walletSpy, tmp, { network: Network.RMS });
    const addressValidationOrder = await testEnv.wrap(validateAddress)({});
    await requestFundsFromFaucet(
      Network.RMS,
      tmpAddress.bech32,
      addressValidationOrder.payload.amount,
    );
    await walletService.send(
      tmpAddress,
      addressValidationOrder.payload.targetAddress,
      addressValidationOrder.payload.amount,
      {},
    );

    const indexer = new IndexerPluginClient(walletService.client);
    await wait(async () => {
      const response = await indexer.nfts({ addressBech32: tmpAddress.bech32 });
      return response.items.length === 2;
    });

    const airdropQuery = admin.firestore().collection(COL.AIRDROP).where('member', '==', tmp);
    let airdropSnap = await airdropQuery.get();
    expect(airdropSnap.size).toBe(2);

    mockWalletReturnValue(walletSpy, tmp, { symbol: token.symbol });
    const claimOrder = await testEnv.wrap(claimMintedTokenOrder)({});
    await requestFundsFromFaucet(
      network,
      claimOrder.payload.targetAddress,
      claimOrder.payload.amount,
    );

    await wait(async () => {
      airdropSnap = await airdropQuery.get();
      const allClaimed = airdropSnap.docs.reduce(
        (acc, doc) => acc && doc.data().status === TokenDropStatus.CLAIMED,
        true,
      );
      return allClaimed;
    });

    await wait(async () => {
      const balance = await walletService.getBalance(tmpAddress.bech32);
      return (
        balance ===
        2 * MIN_IOTA_AMOUNT + claimOrder.payload.amount + addressValidationOrder.payload.amount
      );
    });

    const billPaymentQuery = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('member', '==', tmp)
      .where('type', '==', TransactionType.BILL_PAYMENT);
    const billPayments = (await billPaymentQuery.get()).docs.map((d) => d.data() as Transaction);
    billPayments.forEach((billPayment) => {
      expect(billPayment.payload.token).toBe(token.uid);
      expect(billPayment.payload.tokenSymbol).toBe(token.symbol);
      expect(billPayment.payload.type).toBe(BillPaymentType.BASE_AIRDROP_CLAIM);
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
