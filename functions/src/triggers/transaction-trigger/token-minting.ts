import { ALIAS_OUTPUT_TYPE, FOUNDRY_OUTPUT_TYPE, IAliasOutput, IFoundryOutput, OutputTypes, TransactionHelper } from "@iota/iota.js-next";
import { Converter } from "@iota/util.js-next";
import * as functions from 'firebase-functions';
import { get } from "lodash";
import { TokenStatus } from "../../../interfaces/models";
import { COL } from "../../../interfaces/models/base";
import { Transaction, TransactionMintTokenType, TransactionType } from "../../../interfaces/models/transaction";
import admin from "../../admin.config";
import { serverTime } from "../../utils/dateTime.utils";
import { getRandomEthAddress } from "../../utils/wallet.utils";

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
    case TransactionMintTokenType.SENT_ALIAS_TO_GUARDIAN: {
      await onAliasSendToGuardian(transaction);
      break;
    }
    default: {
      functions.logger.error('Unsupported executable transaction type', transaction)
      throw Error('Unsupported executable transaction type ' + transaction.type)
    }
  }
}

const onAliasMinted = async (transaction: Transaction) => {
  const path = transaction.payload.walletReference.milestoneTransactionPath
  const milestoneTransaction = (await admin.firestore().doc(path).get()).data()!

  const aliasOutputId = Converter.bytesToHex(TransactionHelper.getTransactionPayloadHash(milestoneTransaction.payload), true) + "0000"
  await admin.firestore().doc(`${COL.TOKEN}/${transaction.payload.token}`).update({
    'mintingData.aliasBlockId': milestoneTransaction.blockId,
    'mintingData.aliasId': TransactionHelper.resolveIdFromOutputId(aliasOutputId),
    'mintingData.aliasStorageDeposit': transaction.payload.amount
  })

  const order = <Transaction>{
    type: TransactionType.MINT_TOKEN,
    uid: getRandomEthAddress(),
    member: transaction.member,
    space: transaction.space,
    createdOn: serverTime(),
    network: transaction.network,
    payload: {
      type: TransactionMintTokenType.MINT_FOUNDRY,
      amount: transaction.payload.foundryStorageDeposit || 0,
      sourceAddress: transaction.payload.sourceAddress,
      targetAddress: transaction.payload.targetAddress,
      token: transaction.payload.token,
      foundryStorageDeposit: get(transaction, 'payload.foundryStorageDeposit', 0),
      aliasStorageDeposit: get(transaction, 'payload.aliasStorageDeposit', 0),
      vaultAndGuardianStorageDeposit: get(transaction, 'payload.vaultAndGuardianStorageDeposit', 0),
      tokensInVault: get(transaction, 'payload.tokensInVault', 0)
    }
  }
  await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(order)
}

const onFoundryMinted = async (transaction: Transaction) => {
  const path = transaction.payload.walletReference.milestoneTransactionPath
  const milestoneTransaction = (await admin.firestore().doc(path).get()).data()!

  const aliasOutput = <IAliasOutput>(milestoneTransaction.payload.essence.outputs as OutputTypes[]).find(o => o.type === ALIAS_OUTPUT_TYPE)
  const foundryOutput = <IFoundryOutput>(milestoneTransaction.payload.essence.outputs as OutputTypes[]).find(o => o.type === FOUNDRY_OUTPUT_TYPE)
  const foundryId = TransactionHelper.constructTokenId(aliasOutput.aliasId, foundryOutput.serialNumber, foundryOutput.tokenScheme.type);

  await admin.firestore().doc(`${COL.TOKEN}/${transaction.payload.token}`).update({
    'mintingData.blockId': milestoneTransaction.blockId,
    'mintingData.tokenId': foundryId,
    'mintingData.foundryStorageDeposit': Number(foundryOutput.amount),
    'mintingData.tokensInVault': transaction.payload.tokensInVault
  })

  const order = <Transaction>{
    type: TransactionType.MINT_TOKEN,
    uid: getRandomEthAddress(),
    member: transaction.member,
    space: transaction.space,
    createdOn: serverTime(),
    network: transaction.network,
    payload: {
      type: TransactionMintTokenType.SENT_ALIAS_TO_GUARDIAN,
      amount: transaction.payload.aliasStorageDeposit || 0,
      sourceAddress: transaction.payload.sourceAddress,
      targetAddress: transaction.payload.targetAddress,
      token: transaction.payload.token,
      foundryStorageDeposit: get(transaction, 'payload.foundryStorageDeposit', 0),
      aliasStorageDeposit: get(transaction, 'payload.aliasStorageDeposit', 0),
      vaultAndGuardianStorageDeposit: get(transaction, 'payload.vaultAndGuardianStorageDeposit', 0)
    }
  }
  await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(order)
}

const onAliasSendToGuardian = async (transaction: Transaction) => {
  await admin.firestore().doc(`${COL.TOKEN}/${transaction.payload.token}`).update({
    'mintingData.mintedBy': transaction.member,
    'mintingData.mintedOn': serverTime(),
    'mintingData.network': transaction.network,
    'mintingData.vaultAddress': transaction.payload.sourceAddress,
    status: TokenStatus.MINTED
  })
}