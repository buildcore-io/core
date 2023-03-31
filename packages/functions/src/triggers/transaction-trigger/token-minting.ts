import {
  ALIAS_OUTPUT_TYPE,
  FOUNDRY_OUTPUT_TYPE,
  IAliasOutput,
  IFoundryOutput,
  ITransactionPayload,
  OutputTypes,
  TransactionHelper,
} from '@iota/iota.js-next';
import {
  COL,
  Member,
  Token,
  TokenStatus,
  Transaction,
  TransactionMintTokenType,
  TransactionType,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import { soonDb } from '../../firebase/firestore/soondb';
import { getAddress } from '../../utils/address.utils';
import { indexToString } from '../../utils/block.utils';
import { getTransactionPayloadHex } from '../../utils/smr.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
export const onTokenMintingUpdate = async (transaction: Transaction) => {
  switch (transaction.payload.type) {
    case TransactionMintTokenType.MINT_ALIAS: {
      await onAliasMinted(transaction);
      break;
    }
    case TransactionMintTokenType.MINT_FOUNDRY: {
      await onFoundryMinted(transaction);
      break;
    }
    case TransactionMintTokenType.SEND_ALIAS_TO_GUARDIAN: {
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
  const path = transaction.payload.walletReference.milestoneTransactionPath;
  const milestoneTransaction = (await soonDb().doc(path).get<Record<string, unknown>>())!;

  const aliasOutputId =
    getTransactionPayloadHex(milestoneTransaction.payload as ITransactionPayload) +
    indexToString(0);
  await soonDb()
    .doc(`${COL.TOKEN}/${transaction.payload.token}`)
    .update({
      'mintingData.aliasBlockId': milestoneTransaction.blockId,
      'mintingData.aliasId': TransactionHelper.resolveIdFromOutputId(aliasOutputId),
    });

  const token = <Token>await soonDb().doc(`${COL.TOKEN}/${transaction.payload.token}`).get();
  const order = <Transaction>{
    type: TransactionType.MINT_TOKEN,
    uid: getRandomEthAddress(),
    member: transaction.member,
    space: transaction.space,
    network: transaction.network,
    payload: {
      type: TransactionMintTokenType.MINT_FOUNDRY,
      amount:
        token.mintingData?.foundryStorageDeposit! +
        token.mintingData?.vaultStorageDeposit! +
        token.mintingData?.guardianStorageDeposit!,
      sourceAddress: transaction.payload.sourceAddress,
      token: transaction.payload.token,
    },
  };
  await soonDb().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);
};

const onFoundryMinted = async (transaction: Transaction) => {
  const path = transaction.payload.walletReference.milestoneTransactionPath;
  const milestoneTransaction = (await soonDb().doc(path).get<Record<string, unknown>>())!;

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

  await soonDb()
    .doc(`${COL.TOKEN}/${transaction.payload.token}`)
    .update({
      'mintingData.blockId': milestoneTransaction.blockId,
      'mintingData.tokenId': foundryId,
      'mintingData.meltedTokens': meltedTokens,
      'mintingData.circulatingSupply': totalSupply - meltedTokens,
    });

  const token = <Token>await soonDb().doc(`${COL.TOKEN}/${transaction.payload.token}`).get();
  const member = <Member>await soonDb().doc(`${COL.MEMBER}/${token.mintingData?.mintedBy}`).get();
  const order = <Transaction>{
    type: TransactionType.MINT_TOKEN,
    uid: getRandomEthAddress(),
    member: transaction.member,
    space: transaction.space,
    network: transaction.network,
    payload: {
      type: TransactionMintTokenType.SEND_ALIAS_TO_GUARDIAN,
      amount: token.mintingData?.aliasStorageDeposit!,
      sourceAddress: transaction.payload.sourceAddress,
      targetAddress: getAddress(member, token.mintingData?.network!),
      token: transaction.payload.token,
    },
  };
  await soonDb().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);
};

const onAliasSendToGuardian = async (transaction: Transaction) => {
  const tokenDocRef = soonDb().doc(`${COL.TOKEN}/${transaction.payload.token}`);
  const token = <Token>await tokenDocRef.get();
  await tokenDocRef.update({
    'mintingData.mintedOn': dayjs().toDate(),
    status: TokenStatus.MINTED,
    approved: true,
    tradingDisabled: !token.public || token.tradingDisabled || false,
  });
};
