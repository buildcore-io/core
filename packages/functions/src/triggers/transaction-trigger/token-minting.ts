import { build5Db } from '@build-5/database';
import {
  COL,
  Member,
  Token,
  TokenStatus,
  Transaction,
  TransactionPayloadType,
  TransactionType,
} from '@build-5/interfaces';
import {
  ALIAS_OUTPUT_TYPE,
  FOUNDRY_OUTPUT_TYPE,
  IAliasOutput,
  IFoundryOutput,
  ITransactionPayload,
  OutputTypes,
  TransactionHelper,
} from '@iota/iota.js-next';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions/v2';
import { getAddress } from '../../utils/address.utils';
import { indexToString } from '../../utils/block.utils';
import { getProject, getProjects } from '../../utils/common.utils';
import { getTransactionPayloadHex } from '../../utils/smr.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
export const onTokenMintingUpdate = async (transaction: Transaction) => {
  switch (transaction.payload.type) {
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
      functions.logger.error('Unsupported executable transaction type', transaction);
      throw Error('Unsupported executable transaction type ' + transaction.type);
    }
  }
};

const onAliasMinted = async (transaction: Transaction) => {
  const path = transaction.payload.walletReference?.milestoneTransactionPath!;
  const milestoneTransaction = (await build5Db().doc(path).get<Record<string, unknown>>())!;

  const aliasOutputId =
    getTransactionPayloadHex(milestoneTransaction.payload as ITransactionPayload) +
    indexToString(0);
  await build5Db()
    .doc(`${COL.TOKEN}/${transaction.payload.token}`)
    .update({
      'mintingData.aliasBlockId': milestoneTransaction.blockId,
      'mintingData.aliasId': TransactionHelper.resolveIdFromOutputId(aliasOutputId),
    });

  const token = <Token>await build5Db().doc(`${COL.TOKEN}/${transaction.payload.token}`).get();
  const order: Transaction = {
    project: getProject(transaction),
    projects: getProjects([transaction]),
    type: TransactionType.MINT_TOKEN,
    uid: getRandomEthAddress(),
    member: transaction.member,
    space: transaction.space,
    network: transaction.network,
    payload: {
      type: TransactionPayloadType.MINT_FOUNDRY,
      amount:
        token.mintingData?.foundryStorageDeposit! +
        token.mintingData?.vaultStorageDeposit! +
        token.mintingData?.guardianStorageDeposit!,
      sourceAddress: transaction.payload.sourceAddress,
      token: transaction.payload.token,
    },
  };
  await build5Db().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);
};

const onFoundryMinted = async (transaction: Transaction) => {
  const path = transaction.payload.walletReference?.milestoneTransactionPath!;
  const milestoneTransaction = (await build5Db().doc(path).get<Record<string, unknown>>())!;

  const aliasOutput = <IAliasOutput>(
    ((milestoneTransaction.payload as ITransactionPayload).essence.outputs as OutputTypes[]).find(
      (o) => o.type === ALIAS_OUTPUT_TYPE,
    )
  );
  const foundryOutput = <IFoundryOutput>(
    ((milestoneTransaction.payload as ITransactionPayload).essence.outputs as OutputTypes[]).find(
      (o) => o.type === FOUNDRY_OUTPUT_TYPE,
    )
  );
  const foundryId = TransactionHelper.constructTokenId(
    aliasOutput.aliasId,
    foundryOutput.serialNumber,
    foundryOutput.tokenScheme.type,
  );

  const meltedTokens = Number(foundryOutput.tokenScheme.meltedTokens);
  const totalSupply = Number(foundryOutput.tokenScheme.maximumSupply);

  await build5Db()
    .doc(`${COL.TOKEN}/${transaction.payload.token}`)
    .update({
      'mintingData.blockId': milestoneTransaction.blockId,
      'mintingData.tokenId': foundryId,
      'mintingData.meltedTokens': meltedTokens,
      'mintingData.circulatingSupply': totalSupply - meltedTokens,
    });

  const token = <Token>await build5Db().doc(`${COL.TOKEN}/${transaction.payload.token}`).get();
  const member = <Member>await build5Db().doc(`${COL.MEMBER}/${token.mintingData?.mintedBy}`).get();
  const order: Transaction = {
    project: getProject(transaction),
    projects: getProjects([transaction]),
    type: TransactionType.MINT_TOKEN,
    uid: getRandomEthAddress(),
    member: transaction.member,
    space: transaction.space,
    network: transaction.network,
    payload: {
      type: TransactionPayloadType.SEND_ALIAS_TO_GUARDIAN,
      amount: token.mintingData?.aliasStorageDeposit!,
      sourceAddress: transaction.payload.sourceAddress,
      targetAddress: getAddress(member, token.mintingData?.network!),
      token: transaction.payload.token,
    },
  };
  await build5Db().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);
};

const onAliasSendToGuardian = async (transaction: Transaction) => {
  const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${transaction.payload.token}`);
  const token = <Token>await tokenDocRef.get();
  await tokenDocRef.update({
    'mintingData.mintedOn': dayjs().toDate(),
    status: TokenStatus.MINTED,
    approved: true,
    tradingDisabled: !token.public || token.tradingDisabled || false,
  });
};
