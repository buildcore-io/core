import {
  ALIAS_OUTPUT_TYPE,
  FOUNDRY_OUTPUT_TYPE,
  IAliasOutput,
  IFoundryOutput,
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
import * as functions from 'firebase-functions';
import admin from '../../admin.config';
import { getAddress } from '../../utils/address.utils';
import { cOn, uOn } from '../../utils/dateTime.utils';
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
  const milestoneTransaction = (await admin.firestore().doc(path).get()).data()!;

  const aliasOutputId = getTransactionPayloadHex(milestoneTransaction.payload) + '0000';
  await admin
    .firestore()
    .doc(`${COL.TOKEN}/${transaction.payload.token}`)
    .update(
      uOn({
        'mintingData.aliasBlockId': milestoneTransaction.blockId,
        'mintingData.aliasId': TransactionHelper.resolveIdFromOutputId(aliasOutputId),
      }),
    );

  const token = <Token>(
    (await admin.firestore().doc(`${COL.TOKEN}/${transaction.payload.token}`).get()).data()
  );
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
  await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(cOn(order));
};

const onFoundryMinted = async (transaction: Transaction) => {
  const path = transaction.payload.walletReference.milestoneTransactionPath;
  const milestoneTransaction = (await admin.firestore().doc(path).get()).data()!;

  const aliasOutput = <IAliasOutput>(
    (milestoneTransaction.payload.essence.outputs as OutputTypes[]).find(
      (o) => o.type === ALIAS_OUTPUT_TYPE,
    )
  );
  const foundryOutput = <IFoundryOutput>(
    (milestoneTransaction.payload.essence.outputs as OutputTypes[]).find(
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

  await admin
    .firestore()
    .doc(`${COL.TOKEN}/${transaction.payload.token}`)
    .update(
      uOn({
        'mintingData.blockId': milestoneTransaction.blockId,
        'mintingData.tokenId': foundryId,
        'mintingData.meltedTokens': meltedTokens,
        'mintingData.circulatingSupply': totalSupply - meltedTokens,
      }),
    );

  const token = <Token>(
    (await admin.firestore().doc(`${COL.TOKEN}/${transaction.payload.token}`).get()).data()
  );
  const member = <Member>(
    (await admin.firestore().doc(`${COL.MEMBER}/${token.mintingData?.mintedBy}`).get()).data()
  );
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
  await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(cOn(order));
};

const onAliasSendToGuardian = async (transaction: Transaction) => {
  await admin
    .firestore()
    .doc(`${COL.TOKEN}/${transaction.payload.token}`)
    .update(
      uOn({
        'mintingData.mintedOn': admin.firestore.FieldValue.serverTimestamp(),
        status: TokenStatus.MINTED,
      }),
    );
};
