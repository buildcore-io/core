import { HexHelper } from '@iota/util.js-next';
import {
  Award,
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  SUB_COL,
  TokenDrop,
  TokenDropStatus,
  Transaction,
  TransactionAwardType,
  TransactionType,
} from '@soonaverse/interfaces';
import bigInt from 'big-integer';
import { awardImageMigration } from '../../scripts/dbUpgrades/0_18/award.image.migration';
import admin from '../../src/admin.config';
import { claimMintedTokenOrder } from '../../src/controls/token-minting/claim-minted-token.control';
import { awardRoll } from '../../src/firebase/functions/dbRoll/award.roll';
import { mergeOutputs } from '../../src/utils/basic-output.utils';
import { xpTokenGuardianId, xpTokenUid } from '../../src/utils/config.utils';
import { cOn, serverTime } from '../../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { awaitAllTransactionsForAward } from '../award/common';
import { requestFundsFromFaucet, requestMintedTokenFromFaucet } from '../faucet';
import { Helper, MINTED_TOKEN_ID, VAULT_MNEMONIC } from './Helper';

describe('Award roll test', () => {
  const helper = new Helper();

  beforeEach(async () => {
    await helper.beforeEach();
  });

  const createAndSaveAward = async (func: () => any) => {
    const legacyAward = func();
    const awardDocRef = admin.firestore().doc(`${COL.AWARD}/${legacyAward.uid}`);
    await awardDocRef.create(legacyAward);
    return legacyAward as Award;
  };

  const createAndSaveparticipant = async (memberId: string, count: number, awardId: string) => {
    const participant = {
      uid: memberId,
      comment: 'asd',
      completed: true,
      createdOn: serverTime(),
      count,
      xp: 10,
    };
    const awardDocRef = admin.firestore().doc(`${COL.AWARD}/${awardId}`);
    const participantDocRef = awardDocRef.collection(SUB_COL.PARTICIPANTS).doc(participant.uid);
    await participantDocRef.create(participant);
  };

  const createAndSaveBadges = async (member: string, award: Award, count: number) => {
    for (let i = 0; i < count; ++i) {
      const badgeTransaction = {
        type: 'BADGE',
        uid: getRandomEthAddress(),
        member: member,
        space: award.space,
        network: Network.RMS,
        payload: {
          award: award.uid,
          name: award.name,
          image: 'asd',
          description: award.description,
          xp: 10,
        },
      };
      const badgeDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${badgeTransaction.uid}`);
      await badgeDocRef.create(cOn(badgeTransaction));
    }
  };

  it('Should fund awards, create airdrops and claim tokens&ntts', async () => {
    let award = await createAndSaveAward(helper.halfCompletedAward);

    await createAndSaveparticipant(helper.guardian, 4, award.uid);
    await createAndSaveBadges(helper.guardian, award, 4);
    await createAndSaveparticipant(helper.member, 1, award.uid);
    await createAndSaveBadges(helper.member, award, 1);

    await awardImageMigration(admin.app());

    let order: Transaction = {} as any;
    const req = { body: {} } as any;
    const res = {
      send: (response: Transaction) => {
        order = response;
      },
    } as any;
    await awardRoll(req, res);

    await requestFundsFromFaucet(
      Network.RMS,
      helper.guardianAddress.bech32,
      order.payload.amount + MIN_IOTA_AMOUNT,
    );

    await requestMintedTokenFromFaucet(
      helper.wallet,
      helper.guardianAddress,
      MINTED_TOKEN_ID,
      VAULT_MNEMONIC,
      order.payload.nativeTokens[0].amount,
    );

    await helper.wallet.send(
      helper.guardianAddress,
      order.payload.targetAddress,
      order.payload.amount,
      {
        nativeTokens: [
          {
            id: order.payload.nativeTokens[0].id,
            amount: HexHelper.fromBigInt256(bigInt(order.payload.nativeTokens[0].amount)),
          },
        ],
      },
    );

    const awardsQuery = admin
      .firestore()
      .collection(COL.AWARD)
      .where('createdBy', '==', helper.guardian);
    await wait(async () => {
      const snap = await awardsQuery.get();
      return snap.docs.reduce((acc, act) => acc && act.data()?.approved, true);
    });

    const awardDocRef = admin.firestore().doc(`${COL.AWARD}/${award.uid}`);
    award = (await awardDocRef.get()).data() as Award;

    await assertAirdrops(helper.guardian, award, 4);
    await assertAirdrops(helper.member, award, 1);

    await claimAirdrops(helper.guardian, helper);
    await claimAirdrops(helper.member, helper);

    const billPaymentQuery = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('member', 'in', [helper.guardian, helper.member])
      .where('type', '==', TransactionType.BILL_PAYMENT);
    await wait(async () => {
      const snap = await billPaymentQuery.get();
      return snap.size === 5;
    });

    const nttQuery = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('member', 'in', [helper.guardian, helper.member])
      .where('payload.type', '==', TransactionAwardType.BADGE);
    await wait(async () => {
      const snap = await nttQuery.get();
      return snap.size === 5;
    });

    await awaitAllTransactionsForAward(award.uid);

    const outputs = await helper.wallet.getOutputs(award.address!, [], undefined);
    const output = mergeOutputs(Object.values(outputs));
    expect(Number(output.amount)).toBe(
      award.nativeTokenStorageDeposit + award.nttStorageDeposit / 2,
    );
    expect(Number(output.nativeTokens![0].amount)).toBe(5 * award.badge.tokenReward);
  });
});

const claimAirdrops = async (memberId: string, helper: Helper) => {
  mockWalletReturnValue(helper.walletSpy, memberId, { symbol: helper.token.symbol });
  const claimOrder = await testEnv.wrap(claimMintedTokenOrder)({});
  await requestFundsFromFaucet(
    Network.RMS,
    claimOrder.payload.targetAddress,
    claimOrder.payload.amount,
  );
};

const assertAirdrops = async (memberId: string, award: Award, count: number) => {
  const airdropsQuery = admin.firestore().collection(COL.AIRDROP).where('member', '==', memberId);
  await wait(async () => {
    const snap = await airdropsQuery.get();
    return snap.size === count;
  });
  const airdropsSnap = await airdropsQuery.get();
  for (const doc of airdropsSnap.docs) {
    const airdrop = doc.data() as TokenDrop;
    expect(airdrop.createdBy).toBe(xpTokenGuardianId());
    expect(airdrop.uid).toBeDefined();
    expect(airdrop.member).toBe(memberId);
    expect(airdrop.token).toBe(xpTokenUid());
    expect(airdrop.award).toBe(award.uid);
    expect(airdrop.count).toBe(award.badge.tokenReward);
    expect(airdrop.status).toBe(TokenDropStatus.UNCLAIMED);
    expect(airdrop.sourceAddress).toBe(award.address);
    expect(airdrop.isBaseToken).toBe(false);
  }
};
