import {
  Access,
  COL,
  MediaStatus,
  MIN_IOTA_AMOUNT,
  Token,
  TokenStatus,
  Transaction,
  TransactionCreditType,
  TransactionType,
} from '@soonaverse/interfaces';
import { soonDb } from '../../src/firebase/firestore/soondb';
import { importMintedToken } from '../../src/runtime/firebase/token/minting';
import { getAddress } from '../../src/utils/address.utils';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Token import', () => {
  const helper = new Helper();

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should migrate token', async () => {
    mockWalletReturnValue(helper.walletSpy, helper.guardian.uid, {
      space: helper.importSpace.uid,
      tokenId: helper.token.mintingData?.tokenId,
      network: helper.network,
    });
    const order = await testEnv.wrap(importMintedToken)({});

    const guardianBech32 = getAddress(helper.guardian, helper.network);
    const guardianAddress = await helper.walletService.getAddressDetails(guardianBech32);
    await requestFundsFromFaucet(helper.network, guardianBech32, 2 * MIN_IOTA_AMOUNT);
    await helper.walletService.send(
      guardianAddress,
      order.payload.targetAddress,
      2 * MIN_IOTA_AMOUNT,
      {},
    );

    const migratedTokenDocRef = soonDb().doc(`${COL.TOKEN}/${helper.token.mintingData?.tokenId}`);
    await wait(async () => (await migratedTokenDocRef.get()) !== undefined);

    const migratedToken = <Token>await migratedTokenDocRef.get();

    expect(migratedToken.createdBy).toBe(helper.guardian.uid);
    expect(migratedToken.uid).toBe(helper.token.mintingData?.tokenId);
    expect(migratedToken.name).toBe(helper.token.name);
    expect(migratedToken.symbol).toBe(helper.token.symbol);
    expect(migratedToken.space).toBe(helper.importSpace.uid);
    expect(migratedToken.totalSupply).toBe(helper.token.totalSupply);
    expect(migratedToken.approved).toBe(true);
    expect(migratedToken.rejected).toBe(false);
    expect(migratedToken.public).toBe(false);
    expect(migratedToken.icon).toBeDefined();
    expect(migratedToken.status).toBe(TokenStatus.MINTED);
    expect(migratedToken.access).toBe(Access.OPEN);
    expect(migratedToken.decimals).toBe(4);

    expect(migratedToken.mintingData?.aliasId).toBe(helper.token.mintingData?.aliasId);
    expect(migratedToken.mintingData?.aliasStorageDeposit).toBe(
      helper.token.mintingData?.aliasStorageDeposit,
    );
    expect(migratedToken.mintingData?.tokenId).toBe(helper.token.mintingData?.tokenId);
    expect(migratedToken.mintingData?.foundryStorageDeposit).toBe(
      helper.token.mintingData?.foundryStorageDeposit,
    );
    expect(migratedToken.mintingData?.network).toBe(helper.token.mintingData?.network);
    expect(migratedToken.mintingData?.vaultAddress).toBeDefined();

    expect(migratedToken.mediaStatus).toBe(MediaStatus.PENDING_UPLOAD);
    expect(migratedToken.tradingDisabled).toBe(true);

    const creditQuery = soonDb()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.guardian.uid)
      .where('type', '==', TransactionType.CREDIT)
      .where('payload.type', '==', TransactionCreditType.IMPORT_TOKEN);
    await wait(async () => {
      const snap = await creditQuery.get<Transaction>();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });
    const snap = await creditQuery.get<Transaction>();
    expect(snap[0]?.payload.amount).toBe(2 * MIN_IOTA_AMOUNT);
  });
});
