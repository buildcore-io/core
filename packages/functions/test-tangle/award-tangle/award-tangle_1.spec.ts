import {
  Award,
  COL,
  Member,
  MIN_IOTA_AMOUNT,
  Network,
  Space,
  TangleRequestType,
  Token,
  Transaction,
  TransactionType,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../../src/admin.config';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { AddressDetails, WalletService } from '../../src/services/wallet/wallet';
import { getAddress } from '../../src/utils/address.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { createMember, createSpace, wait } from '../../test/controls/common';
import { MEDIA } from '../../test/set-up';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { saveBaseToken } from './common';

const network = Network.RMS;
let walletSpy: any;

describe('Award tangle request', () => {
  let guardian: string;
  let space: Space;
  let guardianAddress: AddressDetails;
  let walletService: SmrWallet;
  let token: Token;
  let tangleOrder: Transaction;

  beforeAll(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    walletService = (await WalletService.newWallet(network)) as SmrWallet;
    tangleOrder = await getTangleOrder();
  });

  beforeEach(async () => {
    guardian = await createMember(walletSpy);
    space = await createSpace(walletSpy, guardian);

    token = await saveBaseToken(space.uid, guardian);

    const guardianDocRef = admin.firestore().doc(`${COL.MEMBER}/${guardian}`);
    const guardianData = <Member>(await guardianDocRef.get()).data();
    const guardianBech32 = getAddress(guardianData, network);
    guardianAddress = await walletService.getAddressDetails(guardianBech32);
  });

  it('Should create with tangle request', async () => {
    const newAward = awardRequest(space.uid, token.symbol);
    await requestFundsFromFaucet(Network.RMS, guardianAddress.bech32, 5 * MIN_IOTA_AMOUNT);
    await walletService.send(
      guardianAddress,
      tangleOrder.payload.targetAddress,
      5 * MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.AWARD_CREATE,
            ...newAward,
          },
        },
      },
    );

    const creditQuery = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST)
      .where('member', '==', guardian);
    await wait(async () => {
      const snap = await creditQuery.get();
      return snap.size === 1;
    });
    const snap = await creditQuery.get();
    const credit = snap.docs[0].data() as Transaction;
    expect(credit.payload.amount).toBe(5 * MIN_IOTA_AMOUNT);

    const awardDocRef = admin.firestore().doc(`${COL.AWARD}/${credit.payload.response.award}`);
    const award = (await awardDocRef.get()).data() as Award;
    expect(award.uid).toBe(credit.payload.response.award);
    expect(award.name).toBe(newAward.name);
    expect(award.description).toBe(newAward.description);
    expect(award.space).toBe(newAward.space);
    expect(award.endDate).toBeDefined();
    expect(award.network).toBe(newAward.network);
    expect(award.badge.name).toBe(newAward.badge.name);
    expect(award.badge.description).toBe(newAward.badge.description);
    expect(award.badge.total).toBe(newAward.badge.total);
    expect(award.badge.tokenReward).toBe(newAward.badge.tokenReward);
    expect(award.badge.lockTime).toBe(newAward.badge.lockTime);
    expect(award.badge.tokenUid).toBe(token.uid);
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
