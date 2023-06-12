/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  COL,
  KEY_NAME_TANGLE,
  Member,
  Token,
  TokenStatus,
  Transaction,
  TransactionMintTokenType,
  TransactionType,
} from '@build-5/interfaces';
import { IFoundryOutput, IndexerPluginClient, addressBalance } from '@iota/iota.js-next';
import dayjs from 'dayjs';
import { isEqual } from 'lodash';
import { soonDb } from '../../src/firebase/firestore/soondb';
import { mintTokenOrder } from '../../src/runtime/firebase/token/minting';
import { getAddress } from '../../src/utils/address.utils';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { Helper, getAliasOutput, getFoundryMetadata, getStateAndGovernorAddress } from './Helper';

describe('Token minting', () => {
  const helper = new Helper();

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it.each([false, true])('Should mint token', async (hasExpiration: boolean) => {
    const expiresAt = hasExpiration ? dateToTimestamp(dayjs().add(2, 'h').toDate()) : undefined;

    await helper.setup(false, hasExpiration);
    mockWalletReturnValue(helper.walletSpy, helper.guardian.uid, {
      token: helper.token.uid,
      network: helper.network,
    });
    const order = await testEnv.wrap(mintTokenOrder)({});
    await requestFundsFromFaucet(
      helper.network,
      order.payload.targetAddress,
      order.payload.amount,
      expiresAt,
    );

    const tokenDocRef = soonDb().doc(`${COL.TOKEN}/${helper.token.uid}`);
    await wait(async () => {
      const snap = await tokenDocRef.get<Token>();
      return snap?.status === TokenStatus.MINTED;
    });

    helper.token = <Token>await tokenDocRef.get();
    expect(helper.token.status).toBe(TokenStatus.MINTED);
    expect(helper.token.mintingData?.tokenId).toBeDefined();
    expect(helper.token.mintingData?.aliasId).toBeDefined();
    expect(helper.token.mintingData?.aliasBlockId).toBeDefined();
    expect(helper.token.mintingData?.blockId).toBeDefined();
    expect(helper.token.mintingData?.mintedBy).toBe(helper.guardian.uid);
    expect(helper.token.mintingData?.mintedOn).toBeDefined();
    expect(helper.token.mintingData?.vaultAddress).toBe(order.payload.targetAddress);
    expect(helper.token.mintingData?.tokensInVault).toBe(1000);
    expect(helper.token.mintingData?.meltedTokens).toBe(0);
    expect(helper.token.mintingData?.circulatingSupply).toBe(helper.token.totalSupply);
    expect(helper.token.ipfsMedia).toBeDefined();
    expect(helper.token.ipfsMetadata).toBeDefined();
    expect(helper.token.ipfsRoot).toBeDefined();
    expect(helper.token.approved).toBe(true);
    expect(helper.token.tradingDisabled).toBe(!hasExpiration);

    await wait(async () => {
      const balance = await addressBalance(
        helper.walletService.client,
        helper.token.mintingData?.vaultAddress!,
      );
      return Number(Object.values(balance.nativeTokens)[0]) === 1000;
    });
    const guardianData = <Member>await soonDb().doc(`${COL.MEMBER}/${helper.guardian.uid}`).get();
    await wait(async () => {
      const balance = await addressBalance(
        helper.walletService.client,
        getAddress(guardianData, helper.network),
      );
      return Number(Object.values(balance.nativeTokens)[0]) === 500;
    });

    await wait(async () => {
      const aliasOutput = await getAliasOutput(
        helper.walletService,
        helper.token.mintingData?.aliasId!,
      );
      const addresses = await getStateAndGovernorAddress(helper.walletService, aliasOutput);
      return isEqual(addresses, [helper.address.bech32, helper.address.bech32]);
    });

    const mintTransactions = (
      await soonDb()
        .collection(COL.TRANSACTION)
        .where('payload.token', '==', helper.token.uid)
        .where('type', '==', TransactionType.MINT_TOKEN)
        .get()
    ).map((d) => <Transaction>d);
    const aliasTran = mintTransactions.find(
      (t) => t.payload.type === TransactionMintTokenType.MINT_ALIAS,
    );
    expect(aliasTran?.payload?.amount).toBe(helper.token.mintingData?.aliasStorageDeposit);
    const foundryTran = mintTransactions.find(
      (t) => t.payload.type === TransactionMintTokenType.MINT_FOUNDRY,
    );
    expect(foundryTran?.payload?.amount).toBe(
      helper.token.mintingData?.foundryStorageDeposit! +
        helper.token.mintingData?.vaultStorageDeposit! +
        helper.token.mintingData?.guardianStorageDeposit!,
    );
    const aliasTransferTran = mintTransactions.find(
      (t) => t.payload.type === TransactionMintTokenType.SEND_ALIAS_TO_GUARDIAN,
    );
    expect(aliasTransferTran?.payload?.amount).toBe(helper.token.mintingData?.aliasStorageDeposit);

    const indexer = new IndexerPluginClient(helper.walletService.client);
    const foundryOutputId = (await indexer.foundry(helper.token.mintingData?.tokenId!)).items[0];
    const foundryOutput = (await helper.walletService.client.output(foundryOutputId)).output;
    const metadata = getFoundryMetadata(foundryOutput as IFoundryOutput);
    expect(metadata.standard).toBe('IRC30');
    expect(metadata.type).toBe('image/png');
    expect(metadata.name).toBe(helper.token.name);
    expect(metadata.logoUrl).toBeDefined();
    expect(metadata.issuerName).toBe(KEY_NAME_TANGLE);
    expect(metadata.soonaverseId).toBe(helper.token.uid);
    expect(metadata.symbol).toBe(helper.token.symbol.toLowerCase());
    expect(metadata.decimals).toBe(5);
  });
});
