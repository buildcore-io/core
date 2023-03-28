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
import { isEmpty } from 'lodash';
import { soonDb } from '../../src/firebase/firestore/soondb';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
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

    const guardianDocRef = soonDb().doc(`${COL.MEMBER}/${guardian}`);
    const guardianData = <Member>await guardianDocRef.get();
    const guardianBech32 = getAddress(guardianData, network);
    guardianAddress = await walletService.getAddressDetails(guardianBech32);
  });

  it('Should create with tangle request, fund and approve', async () => {
    const newAward = awardRequest(space.uid, token.symbol);
    await requestFundsFromFaucet(Network.RMS, guardianAddress.bech32, 5 * MIN_IOTA_AMOUNT);
    await walletService.send(guardianAddress, tangleOrder.payload.targetAddress, MIN_IOTA_AMOUNT, {
      customMetadata: { request: { requestType: TangleRequestType.AWARD_CREATE, ...newAward } },
    });
    await MnemonicService.store(guardianAddress.bech32, guardianAddress.mnemonic);

    const creditQuery = soonDb()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST)
      .where('member', '==', guardian);
    await wait(async () => {
      const snap = await creditQuery.get();
      return snap.length === 1;
    });
    let snap = await creditQuery.get<Transaction>();
    let credit = snap[0] as Transaction;
    await requestFundsFromFaucet(
      Network.RMS,
      credit.payload.response.address,
      credit.payload.response.amount,
    );

    const awardDocRef = soonDb().doc(`${COL.AWARD}/${credit.payload.response.award}`);
    await wait(async () => {
      const award = (await awardDocRef.get()) as Award;
      return award.approved;
    });

    await walletService.send(guardianAddress, tangleOrder.payload.targetAddress, MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.AWARD_APPROVE_PARTICIPANT,
          award: credit.payload.response.award,
          members: Array.from(Array(150)).map(() => guardian),
        },
      },
    });

    await wait(async () => {
      const snap = await creditQuery.get<Transaction>();
      return (
        snap.length === 2 &&
        snap.reduce((acc, act) => acc && act?.payload?.walletReference?.confirmed, true)
      );
    });
    snap = await creditQuery.get<Transaction>();
    credit = snap.find((d) => !isEmpty(d?.payload?.response?.badges))!;
    expect(Object.keys(credit.payload.response.badges).length).toBe(150);

    await wait(async () => {
      const snap = await soonDb().collection(COL.AIRDROP).where('member', '==', guardian).get();
      return snap.length === 150;
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
    total: 1000,
    image: MEDIA,
    tokenReward: 50000,
    lockTime: 31557600000,
    tokenSymbol,
  },
  network,
});
