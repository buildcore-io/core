import { build5Db } from '@build-5/database';
import {
  Award,
  COL,
  MIN_IOTA_AMOUNT,
  Member,
  Network,
  Space,
  TangleRequestType,
  Token,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
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

  const beforeEach = async (network: Network) => {
    tangleOrder = await getTangleOrder(network);

    walletService = await getWallet(network);

    guardian = await testEnv.createMember();
    space = await testEnv.createSpace(guardian);

    token = await saveBaseToken(space.uid, guardian, network);

    const guardianDocRef = build5Db().doc(COL.MEMBER, guardian);
    const guardianData = <Member>await guardianDocRef.get();
    const guardianBech32 = getAddress(guardianData, network);
    guardianAddress = await walletService.getAddressDetails(guardianBech32);
  };

  it('Should create with tangle request, fund and approve', async () => {
    await beforeEach(network);
    const newAward = awardRequest(space.uid, token.symbol, network);
    await requestFundsFromFaucet(network, guardianAddress.bech32, 5 * MIN_IOTA_AMOUNT);
    await walletService.send(guardianAddress, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
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
      network,
      credit.payload.response!.address as string,
      credit.payload.response!.amount as number,
    );

    const awardDocRef = build5Db().doc(COL.AWARD, credit.payload.response!.award as string);
    await wait(async () => {
      const award = (await awardDocRef.get()) as Award;
      return award.approved;
    });

    await walletService.send(guardianAddress, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.AWARD_APPROVE_PARTICIPANT,
          award: credit.payload.response!.award,
          members: Array.from(Array(150)).map(() => guardian),
        },
      },
    });

    await wait(async () => {
      const snap = await creditQuery.get();
      return (
        snap.length === 2 &&
        snap.reduce((acc, act) => acc && (act?.payload?.walletReference?.confirmed || false), true)
      );
    });
    snap = await creditQuery.get();
    credit = snap.find((d) => !isEmpty(d?.payload?.response?.badges))!;
    expect(Object.keys(credit.payload.response!.badges as any).length).toBe(150);

    await wait(async () => {
      const snap = await build5Db().collection(COL.AIRDROP).where('member', '==', guardian).get();
      return snap.length === 150;
    });
  });
});

const awardRequest = (space: string, tokenSymbol: string, network: Network) => ({
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
