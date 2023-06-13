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
  TransactionAwardType,
  TransactionType,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { build5Db } from '../../src/firebase/firestore/build5Db';
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

    const guardianDocRef = build5Db().doc(`${COL.MEMBER}/${guardian}`);
    const guardianData = <Member>await guardianDocRef.get();
    const guardianBech32 = getAddress(guardianData, network);
    guardianAddress = await walletService.getAddressDetails(guardianBech32);
  });

  it('Should create with tangle request, fund and approve, only send only to smr address', async () => {
    const newAward = awardRequest(space.uid, token.symbol);
    await requestFundsFromFaucet(Network.RMS, guardianAddress.bech32, 5 * MIN_IOTA_AMOUNT);
    await walletService.send(guardianAddress, tangleOrder.payload.targetAddress, MIN_IOTA_AMOUNT, {
      customMetadata: { request: { requestType: TangleRequestType.AWARD_CREATE, ...newAward } },
    });
    await MnemonicService.store(guardianAddress.bech32, guardianAddress.mnemonic);

    const creditQuery = build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST)
      .where('member', '==', guardian);
    await wait(async () => {
      const snap = await creditQuery.get();
      return snap.length === 1;
    });
    let snap = await creditQuery.get();
    let credit = snap[0] as Transaction;
    await requestFundsFromFaucet(
      Network.RMS,
      credit.payload.response.address,
      credit.payload.response.amount,
    );

    const awardDocRef = build5Db().doc(`${COL.AWARD}/${credit.payload.response.award}`);
    await wait(async () => {
      const award = (await awardDocRef.get()) as Award;
      return award.approved;
    });

    const tmp = await walletService.getNewIotaAddressDetails();
    await walletService.send(guardianAddress, tangleOrder.payload.targetAddress, MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.AWARD_APPROVE_PARTICIPANT,
          award: credit.payload.response.award,
          members: [tmp.bech32, tmp.bech32.slice(3)],
        },
      },
    });

    await wait(async () => {
      const snap = await badgeQuery(tmp.bech32).get<Transaction>();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });

    await wait(async () => {
      const snap = await badgeQuery(tmp.bech32.slice(3)).get();
      return snap.length === 1;
    });
    snap = await badgeQuery(tmp.bech32.slice(3)).get();
    const badge = snap[0] as Transaction;
    expect(badge.payload.targetAddress).toBe('');
  });
});

const badgeQuery = (targetAddress: string) =>
  build5Db()
    .collection(COL.TRANSACTION)
    .where('payload.type', '==', TransactionAwardType.BADGE)
    .where('member', '==', targetAddress);

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
