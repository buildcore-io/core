import { ALIAS_OUTPUT_TYPE, IAliasOutput, OutputTypes } from "@iota/iota.js-next";
import { TokenStatus } from "../../../interfaces/models";
import { COL } from "../../../interfaces/models/base";
import { Transaction, TransactionType } from "../../../interfaces/models/transaction";
import admin from "../../admin.config";
import { serverTime } from "../../utils/dateTime.utils";
import { getRandomEthAddress } from "../../utils/wallet.utils";

export const onAliasMinted = async (transaction: Transaction) => {
  const milestoneTransaction = (await admin.firestore().doc(transaction.payload.walletReference.milestoneTransactionPath).get()).data()!
  await admin.firestore().doc(`${COL.TOKEN}/${transaction.payload.token}`).update({
    'mintingData.aliasBlockId': milestoneTransaction.blockId
  })

  const order = <Transaction>{
    type: TransactionType.MINT_FOUNDRY,
    uid: getRandomEthAddress(),
    member: transaction.member,
    space: transaction.space,
    createdOn: serverTime(),
    network: transaction.network,
    payload: {
      amount: transaction.payload.foundryStorageDeposit || 0,
      sourceAddress: transaction.payload.sourceAddress,
      targetAddress: transaction.payload.targetAddress,
      token: transaction.payload.token,
      aliasStorageDeposit: transaction.payload.amount
    }
  }
  await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(order)
}

export const onTokenFoundryCreated = async (transaction: Transaction) => {
  const milestoneTransaction = (await admin.firestore().doc(transaction.payload.walletReference.milestoneTransactionPath).get()).data()!
  await admin.firestore().doc(`${COL.TOKEN}/${transaction.payload.token}`).update({
    'mintingData.blockId': milestoneTransaction.blockId
  })
  const aliasOutput = (milestoneTransaction.payload.essence.outputs as OutputTypes[]).find(o => o.type === ALIAS_OUTPUT_TYPE) as IAliasOutput
  const order = <Transaction>{
    type: TransactionType.CHANGE_ALIAS_OWNER,
    uid: getRandomEthAddress(),
    member: transaction.member,
    space: transaction.space,
    createdOn: serverTime(),
    network: transaction.network,
    payload: {
      amount: transaction.payload.aliasStorageDeposit || 0,
      sourceAddress: transaction.payload.sourceAddress,
      targetAddress: transaction.payload.targetAddress,
      token: transaction.payload.token,
      aliasId: aliasOutput.aliasId
    }
  }
  await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(order)
}

export const onAliasOwnerChanged = async (transaction: Transaction) => {
  await admin.firestore().doc(`${COL.TOKEN}/${transaction.payload.token}`).update({
    'mintingData.mintedBy': transaction.member,
    'mintingData.mintedOn': serverTime(),
    'mintingData.network': transaction.network,
    'mintingData.vaultAddress': transaction.payload.sourceAddress,
    status: TokenStatus.MINTED
  })
}