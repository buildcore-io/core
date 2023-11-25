import { build5Db } from '@build-5/database';
import {
  Award,
  COL,
  Member,
  Network,
  SOON_PROJECT_ID,
  Space,
  Token,
  TokenDrop,
  TokenDropStatus,
  TokenStatus,
  Transaction,
  TransactionPayloadType,
  TransactionType,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { processExpiredAwards } from '../../src/cron/award.cron';
import {
  approveAwardParticipant,
  awardParticipate,
  cancelAward,
  createAward,
  fundAward,
} from '../../src/runtime/firebase/award';
import { joinSpace } from '../../src/runtime/firebase/space';
import { claimMintedTokenOrder } from '../../src/runtime/firebase/token/minting';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { Wallet } from '../../src/services/wallet/wallet';
import { AddressDetails } from '../../src/services/wallet/wallet.service';
import { getAddress } from '../../src/utils/address.utils';
import { mergeOutputs } from '../../src/utils/basic-output.utils';
import { dateToTimestamp, serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import {
  createMember,
  createSpace,
  getRandomSymbol,
  mockWalletReturnValue,
  wait,
} from '../../test/controls/common';
import { MEDIA, getWallet, testEnv } from '../../test/set-up';
import { awaitTransactionConfirmationsForToken } from '../common';
import { requestFundsFromFaucet, requestMintedTokenFromFaucet } from '../faucet';
import { awaitAllTransactionsForAward } from './common';

const network = Network.RMS;
let walletSpy: any;

describe('Create award, native', () => {
  let guardian: string;
  let member: string;
  let space: Space;
  let award: Award;
  let guardianAddress: AddressDetails;
  let walletService: Wallet;
  let token: Token;

  beforeAll(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    walletService = await getWallet(network);
  });

  beforeEach(async () => {
    guardian = await createMember(walletSpy);
    member = await createMember(walletSpy);
    space = await createSpace(walletSpy, guardian);

    mockWalletReturnValue(walletSpy, member, { uid: space?.uid });
    await testEnv.wrap(joinSpace)({});

    token = await saveToken(space.uid, guardian);

    mockWalletReturnValue(walletSpy, member, awardRequest(space.uid, token.symbol));
    award = await testEnv.wrap(createAward)({});

    const guardianDocRef = build5Db().doc(`${COL.MEMBER}/${guardian}`);
    const guardianData = <Member>await guardianDocRef.get();
    const guardianBech32 = getAddress(guardianData, network);
    guardianAddress = await walletService.getAddressDetails(guardianBech32);
  });

  it.each([false, true])('Should create and fund award, cancel', async (shouldCancel: boolean) => {
    mockWalletReturnValue(walletSpy, guardian, { uid: award.uid });
    const order = await testEnv.wrap(fundAward)({});

    await requestFundsFromFaucet(network, guardianAddress.bech32, order.payload.amount);
    await requestMintedTokenFromFaucet(
      walletService,
      guardianAddress,
      MINTED_TOKEN_ID,
      VAULT_MNEMONIC,
      15,
    );
    await walletService.send(guardianAddress, order.payload.targetAddress, order.payload.amount, {
      nativeTokens: [{ id: MINTED_TOKEN_ID, amount: BigInt(15) }],
    });
    await MnemonicService.store(guardianAddress.bech32, guardianAddress.mnemonic);

    const awardDocRef = build5Db().doc(`${COL.AWARD}/${award.uid}`);
    await wait(async () => {
      const award = <Award>await awardDocRef.get();
      return award.approved && award.funded;
    });
    const awardData = <Award>await awardDocRef.get();
    expect(awardData.aliasBlockId).toBeDefined();
    expect(awardData.aliasId).toBeDefined();
    expect(awardData.collectionBlockId).toBeDefined();
    expect(awardData.collectionId).toBeDefined();

    mockWalletReturnValue(walletSpy, member, { uid: award.uid });
    await testEnv.wrap(awardParticipate)({});

    mockWalletReturnValue(walletSpy, guardian, { award: award.uid, members: [member] });
    await testEnv.wrap(approveAwardParticipant)({});

    if (shouldCancel) {
      mockWalletReturnValue(walletSpy, guardian, { uid: award.uid });
      await testEnv.wrap(cancelAward)({});
    } else {
      await awardDocRef.update({ endDate: dateToTimestamp(dayjs().subtract(1, 'minute')) });
      await processExpiredAwards();
      await processExpiredAwards();
    }

    const nttQuery = build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', member)
      .where('payload.type', '==', TransactionPayloadType.BADGE);
    await wait(async () => {
      const snap = await nttQuery.get();
      return snap.length === 1;
    });

    await awaitAllTransactionsForAward(award.uid);

    const memberDocRef = build5Db().doc(`${COL.MEMBER}/${member}`);
    const memberData = <Member>await memberDocRef.get();
    const memberBech32 = getAddress(memberData, network);
    await wait(async () => {
      const response = await walletService.client.nftOutputIds([{ address: memberBech32 }]);
      return response.items.length === 1;
    });

    const airdropQuery = build5Db().collection(COL.AIRDROP).where('member', '==', member);
    let airdropSnap = await airdropQuery.get<TokenDrop>();
    expect(airdropSnap.length).toBe(1);

    mockWalletReturnValue(walletSpy, member, { symbol: token.symbol });
    const claimOrder = await testEnv.wrap(claimMintedTokenOrder)({});
    await requestFundsFromFaucet(
      network,
      claimOrder.payload.targetAddress,
      claimOrder.payload.amount,
    );
    await wait(async () => {
      airdropSnap = await airdropQuery.get<TokenDrop>();
      const allClaimed = airdropSnap.reduce(
        (acc, doc) => acc && doc.status === TokenDropStatus.CLAIMED,
        true,
      );
      return allClaimed;
    });
    await awaitTransactionConfirmationsForToken(token.uid);

    const outputs = await walletService.getOutputs(memberBech32, [], false);
    const output = mergeOutputs(Object.values(outputs));
    const nativeToken = output.nativeTokens?.find((nt) => nt.id === MINTED_TOKEN_ID);
    expect(Number(nativeToken?.amount)).toBe(5);

    const creditQuery = build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', guardian);
    await wait(async () => {
      const snap = await creditQuery.get<Transaction>();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });
    const credit = <Transaction>(await creditQuery.get())[0];
    expect(credit.payload.token).toBe(token.uid);
    expect(credit.payload.tokenSymbol).toBe(token.symbol);
    expect(credit.payload.type).toBe(TransactionPayloadType.AWARD_COMPLETED);

    const burnAliasQuery = build5Db()
      .collection(COL.TRANSACTION)
      .where('payload.type', '==', TransactionPayloadType.BURN_ALIAS)
      .where('member', '==', guardian);
    await wait(async () => {
      const snap = await burnAliasQuery.get<Transaction>();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });
    const { amount } = await walletService.getBalance(guardianAddress.bech32);
    expect(amount).toBe(award.nativeTokenStorageDeposit + award.aliasStorageDeposit);
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
    total: 3,
    image: MEDIA,
    tokenReward: 5,
    tokenSymbol,
    lockTime: 31557600000,
  },
  network,
});

const saveToken = async (space: string, guardian: string) => {
  const token = {
    project: SOON_PROJECT_ID,
    symbol: getRandomSymbol(),
    approved: true,
    updatedOn: serverTime(),
    createdOn: serverTime(),
    space,
    uid: wallet.getRandomEthAddress(),
    createdBy: guardian,
    name: 'MyToken',
    status: TokenStatus.MINTED,
    access: 0,
    icon: MEDIA,
    mintingData: {
      network: Network.RMS,
      tokenId: MINTED_TOKEN_ID,
    },
  };
  await build5Db().doc(`${COL.TOKEN}/${token.uid}`).set(token);
  return token as Token;
};

export const VAULT_MNEMONIC =
  'lift primary tornado antenna confirm smoke oxygen rescue drift tenant mirror small barrel people predict elevator retreat hold various adjust keep decade valve scheme';
export const MINTED_TOKEN_ID =
  '0x08c9c7b7e22a43ed9f14fdcc876bd9fb56e10ccac4b3c2299013d71b363db801a40100000000';
