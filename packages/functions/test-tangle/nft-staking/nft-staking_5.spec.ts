import {
  Award,
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  Nft,
  StakeType,
  Transaction,
  TransactionAwardType,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { soonDb } from '../../src/firebase/firestore/soondb';
import { approveAwardParticipant, createAward, fundAward } from '../../src/runtime/firebase/award';
import { stakeNft } from '../../src/runtime/firebase/nft';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { MEDIA, testEnv } from '../../test/set-up';
import { saveBaseToken } from '../award/common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Stake nft', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should deposit badge ntt ', async () => {
    const token = await saveBaseToken(helper.space!.uid, helper.guardian!);
    mockWalletReturnValue(
      helper.walletSpy,
      helper.guardian!,
      awardRequest(helper.space!.uid, token.symbol),
    );
    let award = await testEnv.wrap(createAward)({});

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { uid: award.uid });
    const order = await testEnv.wrap(fundAward)({});
    await requestFundsFromFaucet(Network.RMS, order.payload.targetAddress, order.payload.amount);

    const awardDocRef = soonDb().doc(`${COL.AWARD}/${award.uid}`);
    await wait(async () => {
      award = <Award>await awardDocRef.get();
      return award.approved && award.funded;
    });

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, {
      award: award.uid,
      members: [helper.guardian!],
    });
    await testEnv.wrap(approveAwardParticipant)({});

    const nttQuery = soonDb()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.guardian!)
      .where('payload.type', '==', TransactionAwardType.BADGE);
    await wait(async () => {
      const snap = await nttQuery.get<Transaction>();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, {
      network: Network.RMS,
      weeks: 25,
      type: StakeType.DYNAMIC,
    });
    const stakeNftOrder = await testEnv.wrap(stakeNft)({});
    await helper.sendNftToAddress(
      helper.guardianAddress!,
      stakeNftOrder.payload.targetAddress,
      undefined,
      undefined,
      MIN_IOTA_AMOUNT,
    );

    const stakeQuery = soonDb().collection(COL.NFT_STAKE).where('member', '==', helper.guardian);
    await wait(async () => {
      const snap = await stakeQuery.get();
      return snap.length === 1;
    });

    const nftQuery = soonDb().collection(COL.NFT).where('space', '==', helper.space?.uid);
    const nftSnap = await nftQuery.get<Nft>();
    expect(nftSnap.length).toBe(1);
    expect(nftSnap[0]?.space).toBe(award.space);
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
    lockTime: 0,
    tokenSymbol,
  },
  network: Network.RMS,
});
