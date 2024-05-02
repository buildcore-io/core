import { database } from '@buildcore/database';
import {
  Award,
  COL,
  MIN_IOTA_AMOUNT,
  Member,
  Network,
  NetworkAddress,
  Space,
  TangleRequestType,
  Token,
  Transaction,
  TransactionPayloadType,
  TransactionType,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { Wallet } from '../../src/services/wallet/wallet';
import { AddressDetails } from '../../src/services/wallet/wallet.service';
import { getAddress } from '../../src/utils/address.utils';
import { wait } from '../../test/controls/common';
import { MEDIA, getWallet, testEnv } from '../../test/set-up';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { saveBaseToken } from './common';

const network = Network.RMS;

describe('Award tangle request', () => {
  let guardian: string;
  let space: Space;
  let guardianAddress: AddressDetails;
  let walletService: Wallet;
  let token: Token;
  let tangleOrder: Transaction;

  beforeAll(async () => {
    walletService = await getWallet(network);
    tangleOrder = await getTangleOrder(Network.RMS);
  });

  beforeEach(async () => {
    guardian = await testEnv.createMember();
    space = await testEnv.createSpace(guardian);

    token = await saveBaseToken(space.uid, guardian, Network.RMS);

    const guardianDocRef = database().doc(COL.MEMBER, guardian);
    const guardianData = <Member>await guardianDocRef.get();
    const guardianBech32 = getAddress(guardianData, network);
    guardianAddress = await walletService.getAddressDetails(guardianBech32);
  });

  it('Should create with tangle request, fund and approve, only send to smr address', async () => {
    const newAward = awardRequest(space.uid, token.symbol);
    await requestFundsFromFaucet(Network.RMS, guardianAddress.bech32, 5 * MIN_IOTA_AMOUNT);
    await walletService.send(guardianAddress, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
      customMetadata: { request: { requestType: TangleRequestType.AWARD_CREATE, ...newAward } },
    });
    await MnemonicService.store(guardianAddress.bech32, guardianAddress.mnemonic);

    const creditQuery = database()
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
      credit.payload.response!.address as string,
      credit.payload.response!.amount as number,
    );

    const awardDocRef = database().doc(COL.AWARD, credit.payload.response!.award as string);
    await wait(async () => {
      const award = (await awardDocRef.get()) as Award;
      return award.approved;
    });

    const tmp = await walletService.getNewIotaAddressDetails();
    await walletService.send(guardianAddress, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.AWARD_APPROVE_PARTICIPANT,
          award: credit.payload.response!.award,
          members: [tmp.bech32, tmp.bech32.slice(3)],
        },
      },
    });

    await wait(async () => {
      const snap = await badgeQuery(tmp.bech32).get();
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

const badgeQuery = (targetAddress: NetworkAddress) =>
  database()
    .collection(COL.TRANSACTION)
    .where('payload_type', '==', TransactionPayloadType.BADGE)
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
