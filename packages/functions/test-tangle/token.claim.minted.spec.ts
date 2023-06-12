/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  COL,
  Member,
  Network,
  Space,
  SUB_COL,
  Token,
  TokenDistribution,
  TokenDrop,
  TokenDropStatus,
  TokenStatus,
  Transaction,
  TransactionType,
  WenError,
} from '@build5/interfaces';
import { addressBalance } from '@iota/iota.js-next';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { retryWallet } from '../src/cron/wallet.cron';
import { soonDb } from '../src/firebase/firestore/soondb';
import { claimMintedTokenOrder, mintTokenOrder } from '../src/runtime/firebase/token/minting';
import { MnemonicService } from '../src/services/wallet/mnemonic';
import { SmrWallet } from '../src/services/wallet/SmrWalletService';
import { dateToTimestamp, serverTime } from '../src/utils/dateTime.utils';
import * as wallet from '../src/utils/wallet.utils';
import { getRandomEthAddress } from '../src/utils/wallet.utils';
import {
  createMember,
  createSpace,
  expectThrow,
  getRandomSymbol,
  mockWalletReturnValue,
  wait,
} from '../test/controls/common';
import { getWallet, MEDIA, testEnv } from '../test/set-up';
import { awaitTransactionConfirmationsForToken } from './common';
import { requestFundsFromFaucet } from './faucet';

let walletSpy: any;
const network = Network.RMS;

describe('Token minting', () => {
  let guardian: Member;
  let space: Space;
  let token: any;
  let walletService: SmrWallet;

  beforeEach(async () => {
    walletService = (await getWallet(network)) as SmrWallet;
    walletSpy = jest.spyOn(wallet, 'decodeAuth');

    const guardianId = await createMember(walletSpy);
    guardian = <Member>await soonDb().doc(`${COL.MEMBER}/${guardianId}`).get();

    space = await createSpace(walletSpy, guardian.uid);
    token = await saveToken(walletService, space.uid, guardian.uid);
  });

  it('Claim minted tokens by guardian', async () => {
    await soonDb()
      .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardian.uid}`)
      .set({ tokenOwned: 1 });

    mockWalletReturnValue(walletSpy, guardian.uid, { symbol: token.symbol });
    const order = await testEnv.wrap(claimMintedTokenOrder)({});
    await requestFundsFromFaucet(network, order.payload.targetAddress, order.payload.amount);

    const query = soonDb()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('member', '==', guardian.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1;
    });
    const billPayment = (await query.get())[0] as Transaction;
    expect(billPayment.payload.amount).toBe(order.payload.amount);
    expect(billPayment.payload.nativeTokens[0].amount).toBe(1);

    const tokenData = <Token>await soonDb().doc(`${COL.TOKEN}/${token.uid}`).get();
    expect(tokenData.mintingData?.tokensInVault).toBe(9);

    await awaitTransactionConfirmationsForToken(token.uid);
  });

  it('Claim owned and airdroped-vesting', async () => {
    const distributionDocRef = soonDb().doc(
      `${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardian.uid}`,
    );
    await distributionDocRef.set({ tokenOwned: 1 });

    const airdrop: TokenDrop = {
      createdOn: serverTime(),
      createdBy: guardian.uid!,
      uid: getRandomEthAddress(),
      member: guardian.uid,
      token: token.uid,
      vestingAt: dateToTimestamp(dayjs().add(1, 'd')),
      count: 1,
      status: TokenDropStatus.UNCLAIMED,
    };
    await soonDb().doc(`${COL.AIRDROP}/${airdrop.uid}`).create(airdrop);

    mockWalletReturnValue(walletSpy, guardian.uid, { symbol: token.symbol });
    const order = await testEnv.wrap(claimMintedTokenOrder)({});
    await requestFundsFromFaucet(network, order.payload.targetAddress, order.payload.amount);

    const query = soonDb()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('member', '==', guardian.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 2;
    });
    const billPayments = (await query.get()).map((d) => d as Transaction);
    const vesting = billPayments.filter((bp) => !isEmpty(bp.payload.vestingAt))[0];
    expect(vesting.payload.amount).toBe(50100);
    expect(vesting.payload.nativeTokens[0].amount).toBe(1);

    const unlocked = billPayments.filter((bp) => isEmpty(bp.payload.vestingAt))[0];
    expect(unlocked.payload.amount).toBe(order.payload.amount - 50100);
    expect(unlocked.payload.nativeTokens[0].amount).toBe(1);

    const tokenData = <Token>await soonDb().doc(`${COL.TOKEN}/${token.uid}`).get();
    expect(tokenData.mintingData?.tokensInVault).toBe(8);
    await awaitTransactionConfirmationsForToken(token.uid);
  });

  it('Claim when only airdropped', async () => {
    const airdrop: TokenDrop = {
      createdOn: serverTime(),
      createdBy: guardian.uid!,
      uid: getRandomEthAddress(),
      member: guardian.uid,
      token: token.uid,
      vestingAt: dateToTimestamp(dayjs().add(1, 'd')),
      count: 1,
      status: TokenDropStatus.UNCLAIMED,
    };
    await soonDb().doc(`${COL.AIRDROP}/${airdrop.uid}`).create(airdrop);

    mockWalletReturnValue(walletSpy, guardian.uid, { symbol: token.symbol });
    const order = await testEnv.wrap(claimMintedTokenOrder)({});
    await requestFundsFromFaucet(network, order.payload.targetAddress, order.payload.amount);

    const query = soonDb()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('member', '==', guardian.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1;
    });

    const tokenData = <Token>await soonDb().doc(`${COL.TOKEN}/${token.uid}`).get();
    expect(tokenData.mintingData?.tokensInVault).toBe(9);

    await awaitTransactionConfirmationsForToken(token.uid);
  });

  it('Claim multiple airdropped', async () => {
    for (let i = 0; i < 3; ++i) {
      const airdrop: TokenDrop = {
        createdOn: serverTime(),
        createdBy: guardian.uid!,
        uid: getRandomEthAddress(),
        member: guardian.uid,
        token: token.uid,
        vestingAt: dateToTimestamp(dayjs().add(i + 1, 'd')),
        count: i + 1,
        status: TokenDropStatus.UNCLAIMED,
      };
      await soonDb().doc(`${COL.AIRDROP}/${airdrop.uid}`).create(airdrop);
    }
    mockWalletReturnValue(walletSpy, guardian.uid, { symbol: token.symbol });
    const order = await testEnv.wrap(claimMintedTokenOrder)({});
    await requestFundsFromFaucet(network, order.payload.targetAddress, order.payload.amount);

    const query = soonDb()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('member', '==', guardian.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 3;
    });

    const tokenData = <Token>await soonDb().doc(`${COL.TOKEN}/${token.uid}`).get();
    expect(tokenData.mintingData?.tokensInVault).toBe(4);

    await wait(async () => {
      const snap = await query.get<Transaction>();
      const processed = snap.filter((d) => !isEmpty(d?.payload?.walletReference?.processedOn));
      return processed.length == 3;
    });

    await wait(async () => {
      const snap = await query.get<Transaction>();
      const confirmed = snap.filter((d) => d!.payload.walletReference.confirmed).length;
      if (confirmed !== 3) {
        await retryWallet();
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      return confirmed === 3;
    });

    await awaitTransactionConfirmationsForToken(token.uid);
  });

  it('Should credit second claim', async () => {
    await soonDb()
      .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardian.uid}`)
      .set({ tokenOwned: 1 });
    mockWalletReturnValue(walletSpy, guardian.uid, { symbol: token.symbol });
    const order = await testEnv.wrap(claimMintedTokenOrder)({});
    const order2 = await testEnv.wrap(claimMintedTokenOrder)({});

    await requestFundsFromFaucet(network, order.payload.targetAddress, order.payload.amount);
    await requestFundsFromFaucet(network, order2.payload.targetAddress, order2.payload.amount);

    await wait(async () => {
      const distributionDocRef = soonDb().doc(
        `${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardian.uid}`,
      );
      const distribution = <TokenDistribution>await distributionDocRef.get();
      return distribution?.mintedClaimedOn !== undefined;
    });

    const query = soonDb()
      .collection(COL.TRANSACTION)
      .where('member', '==', guardian.uid)
      .where('type', '==', TransactionType.CREDIT);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1;
    });

    const tokenData = <Token>await soonDb().doc(`${COL.TOKEN}/${token.uid}`).get();
    expect(tokenData.mintingData?.tokensInVault).toBe(9);
  });

  it('Should throw, nothing to claim, can not create order', async () => {
    await soonDb()
      .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardian.uid}`)
      .set({ tokenOwned: 1 });
    mockWalletReturnValue(walletSpy, guardian.uid, { symbol: token.symbol });
    const order = await testEnv.wrap(claimMintedTokenOrder)({});
    await requestFundsFromFaucet(network, order.payload.targetAddress, order.payload.amount);

    await wait(async () => {
      const distributionDocRef = soonDb().doc(
        `${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardian.uid}`,
      );
      const distribution = <TokenDistribution>await distributionDocRef.get();
      return distribution.mintedClaimedOn !== undefined;
    });

    await expectThrow(testEnv.wrap(claimMintedTokenOrder)({}), WenError.no_tokens_to_claim.key);

    const tokenData = <Token>await soonDb().doc(`${COL.TOKEN}/${token.uid}`).get();
    expect(tokenData.mintingData?.tokensInVault).toBe(9);

    await awaitTransactionConfirmationsForToken(token.uid);
  });

  it('Should return deposit after claiming all', async () => {
    const minterId = await createMember(walletSpy);
    const minter = <Member>await soonDb().doc(`${COL.MEMBER}/${minterId}`).get();
    space = await createSpace(walletSpy, minter.uid);
    token = await saveToken(walletService, space.uid, minter.uid, true);
    await soonDb()
      .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardian.uid}`)
      .set({ tokenOwned: 1 });

    mockWalletReturnValue(walletSpy, minter.uid, { token: token.uid, network });
    const order = await testEnv.wrap(mintTokenOrder)({});
    await requestFundsFromFaucet(network, order.payload.targetAddress, order.payload.amount);

    const tokenDocRef = soonDb().doc(`${COL.TOKEN}/${token.uid}`);
    await wait(async () => {
      const snap = await tokenDocRef.get<Token>();
      return snap?.status === TokenStatus.MINTED;
    });

    token = await tokenDocRef.get();
    await wait(async () => {
      const balance = await addressBalance(walletService.client, token.mintingData?.vaultAddress);
      return Number(Object.values(balance.nativeTokens)[0]) === 1;
    });

    mockWalletReturnValue(walletSpy, guardian.uid, { symbol: token.symbol });
    const claimOrder = await testEnv.wrap(claimMintedTokenOrder)({});
    await requestFundsFromFaucet(
      network,
      claimOrder.payload.targetAddress,
      claimOrder.payload.amount,
    );

    const query = soonDb()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('member', '==', guardian.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1;
    });

    const creditQuery = soonDb()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', minter.uid);
    await wait(async () => {
      const snap = await creditQuery.get();
      return snap.length === 1;
    });

    await awaitTransactionConfirmationsForToken(token.uid);
  });
});

const saveToken = async (
  walletService: SmrWallet,
  space: string,
  guardian: string,
  notMinted = false,
) => {
  const vaultAddress = await walletService.getIotaAddressDetails(VAULT_MNEMONIC);
  await MnemonicService.store(vaultAddress.bech32, vaultAddress.mnemonic);
  const tokenId = wallet.getRandomEthAddress();
  const token = {
    symbol: getRandomSymbol(),
    approved: true,
    updatedOn: serverTime(),
    createdOn: serverTime(),
    space,
    uid: tokenId,
    createdBy: guardian,
    name: 'MyToken',
    status: notMinted ? TokenStatus.AVAILABLE : TokenStatus.MINTED,
    mintingData: notMinted
      ? {}
      : {
          tokenId: MINTED_TOKEN_ID,
          network: Network.RMS,
          vaultAddress: vaultAddress.bech32,
          tokensInVault: 10,
        },
    access: 0,
    totalSupply: 10,
    icon: MEDIA,
  };
  await soonDb().doc(`${COL.TOKEN}/${token.uid}`).set(token);
  return token;
};

const VAULT_MNEMONIC =
  'able seek despair task prize rack isolate usual select tooth minor seed empower pulp venture tourist castle south enroll sauce milk surge evolve reflect';
const MINTED_TOKEN_ID =
  '0x08251a171a5cf36c755b64ff204f95834fa09b1129992d18bfed817bc8a30a0f410100000000';
