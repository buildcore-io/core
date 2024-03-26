import { PgTransaction, build5Db } from '@build-5/database';
import {
  COL,
  Member,
  Network,
  Token,
  TokenStatus,
  Transaction,
  TransactionPayloadType,
  TransactionType,
} from '@build-5/interfaces';
import {
  AliasOutput,
  FoundryOutput,
  OutputType,
  RegularTransactionEssence,
  SimpleTokenScheme,
  TransactionPayload,
  Utils,
} from '@iota/sdk';
import dayjs from 'dayjs';
import { getAddress } from '../../utils/address.utils';
import { getProject } from '../../utils/common.utils';
import { logger } from '../../utils/logger';
import { getPathParts } from '../../utils/milestone';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const onTokenMintingUpdate = async (transaction: PgTransaction) => {
  switch (transaction.payload_type) {
    case TransactionPayloadType.MINT_ALIAS: {
      await onAliasMinted(transaction);
      break;
    }
    case TransactionPayloadType.MINT_FOUNDRY: {
      await onFoundryMinted(transaction);
      break;
    }
    case TransactionPayloadType.SEND_ALIAS_TO_GUARDIAN: {
      await onAliasSendToGuardian(transaction);
      break;
    }
    default: {
      logger.error('Unsupported executable transaction type error', transaction);
      throw Error('Unsupported executable transaction type ' + transaction.type);
    }
  }
};

const onAliasMinted = async (transaction: PgTransaction) => {
  const path = transaction.payload_walletReference_milestoneTransactionPath!;
  const { col, colId, subCol, subColId } = getPathParts(path);
  const milestoneTransaction = (await build5Db().doc(col, colId, subCol, subColId).get())!;

  const aliasOutputId = Utils.computeOutputId(
    Utils.transactionId(milestoneTransaction.payload as unknown as TransactionPayload),
    0,
  );
  await build5Db()
    .doc(COL.TOKEN, transaction.payload_token!)
    .update({
      mintingData_aliasBlockId: milestoneTransaction.blockId as string,
      mintingData_aliasId: Utils.computeAliasId(aliasOutputId),
    });

  const token = <Token>await build5Db().doc(COL.TOKEN, transaction.payload_token!).get();
  const order: Transaction = {
    project: getProject(transaction),
    type: TransactionType.MINT_TOKEN,
    uid: getRandomEthAddress(),
    member: transaction.member,
    space: transaction.space,
    network: transaction.network as Network,
    payload: {
      type: TransactionPayloadType.MINT_FOUNDRY,
      amount:
        token.mintingData?.foundryStorageDeposit! +
        token.mintingData?.vaultStorageDeposit! +
        token.mintingData?.guardianStorageDeposit!,
      sourceAddress: transaction.payload_sourceAddress,
      token: transaction.payload_token,
    },
  };
  await build5Db().doc(COL.TRANSACTION, order.uid).create(order);
};

const onFoundryMinted = async (transaction: PgTransaction) => {
  const path = transaction.payload_walletReference_milestoneTransactionPath!;
  const { col, colId, subCol, subColId } = getPathParts(path);
  const milestoneTransaction = (await build5Db().doc(col, colId, subCol, subColId).get())!;

  const payload = milestoneTransaction.payload as unknown as TransactionPayload;
  const essence = payload.essence as RegularTransactionEssence;
  const aliasOutput = <AliasOutput>essence.outputs.find((o) => o.type === OutputType.Alias);
  const foundryOutput = <FoundryOutput>essence.outputs.find((o) => o.type === OutputType.Foundry);
  const foundryId = Utils.computeFoundryId(
    aliasOutput.aliasId,
    foundryOutput.serialNumber,
    foundryOutput.tokenScheme.type,
  );

  const tokenScheme = foundryOutput.tokenScheme as SimpleTokenScheme;
  const meltedTokens = Number(tokenScheme.meltedTokens);
  const totalSupply = Number(tokenScheme.maximumSupply);

  await build5Db()
    .doc(COL.TOKEN, transaction.payload_token!)
    .update({
      mintingData_blockId: milestoneTransaction.blockId as string,
      mintingData_tokenId: foundryId,
      mintingData_meltedTokens: meltedTokens,
      mintingData_circulatingSupply: totalSupply - meltedTokens,
    });

  const token = <Token>await build5Db().doc(COL.TOKEN, transaction.payload_token!).get();
  const member = <Member>await build5Db().doc(COL.MEMBER, token.mintingData?.mintedBy!).get();
  const order: Transaction = {
    project: getProject(transaction),
    type: TransactionType.MINT_TOKEN,
    uid: getRandomEthAddress(),
    member: transaction.member,
    space: transaction.space,
    network: (transaction.network as Network)!,
    payload: {
      type: TransactionPayloadType.SEND_ALIAS_TO_GUARDIAN,
      amount: token.mintingData?.aliasStorageDeposit!,
      sourceAddress: transaction.payload_sourceAddress,
      targetAddress: getAddress(member, token.mintingData?.network!),
      token: transaction.payload_token,
    },
  };
  await build5Db().doc(COL.TRANSACTION, order.uid).create(order);
};

const onAliasSendToGuardian = async (transaction: PgTransaction) => {
  const tokenDocRef = build5Db().doc(COL.TOKEN, transaction.payload_token!);
  const token = <Token>await tokenDocRef.get();
  await tokenDocRef.update({
    mintingData_mintedOn: dayjs().toDate(),
    status: TokenStatus.MINTED,
    approved: true,
    tradingDisabled: !token.public || token.tradingDisabled || false,
  });
};
