import { database } from '@buildcore/database';
import {
  Award,
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  StakeType,
  Transaction,
  TransactionPayloadType,
  WEN_FUNC,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { wait } from '../../test/controls/common';
import { MEDIA, mockWalletReturnValue, testEnv } from '../../test/set-up';
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
    mockWalletReturnValue(helper.guardian!, awardRequest(helper.space!.uid, token.symbol));
    let award = await testEnv.wrap<Award>(WEN_FUNC.createAward);

    mockWalletReturnValue(helper.guardian!, { uid: award.uid });
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.fundAward);
    await requestFundsFromFaucet(Network.RMS, order.payload.targetAddress, order.payload.amount);

    const awardDocRef = database().doc(COL.AWARD, award.uid);
    await wait(async () => {
      award = <Award>await awardDocRef.get();
      return award.approved && award.funded;
    });

    mockWalletReturnValue(helper.guardian!, {
      award: award.uid,
      members: [helper.guardian!],
    });
    await testEnv.wrap(WEN_FUNC.approveParticipantAward);

    const nttQuery = database()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.guardian!)
      .where('payload_type', '==', TransactionPayloadType.BADGE);
    await wait(async () => {
      const snap = await nttQuery.get();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });

    mockWalletReturnValue(helper.guardian!, {
      network: Network.RMS,
      weeks: 25,
      type: StakeType.DYNAMIC,
    });
    const stakeNftOrder = await testEnv.wrap<Transaction>(WEN_FUNC.stakeNft);
    await helper.sendNftToAddress(
      helper.guardianAddress!,
      stakeNftOrder.payload.targetAddress!,
      undefined,
      undefined,
      MIN_IOTA_AMOUNT,
    );

    const stakeQuery = database().collection(COL.NFT_STAKE).where('member', '==', helper.guardian);
    await wait(async () => {
      const snap = await stakeQuery.get();
      return snap.length === 1;
    });

    const nftQuery = database().collection(COL.NFT).where('space', '==', helper.space?.uid);
    const nftSnap = await nftQuery.get();
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
