import { HexHelper } from '@iota/util.js-next';
import bigInt from 'big-integer';
import bigDecimal from 'js-big-decimal';
import { DEFAULT_NETWORK } from '../../interfaces/config';
import { Member, Transaction, TransactionCreditType, TransactionType } from '../../interfaces/models';
import { COL, SUB_COL } from '../../interfaces/models/base';
import { Token, TokenBuySellOrder, TokenBuySellOrderStatus, TokenBuySellOrderType, TokenPurchase, TokenStatus } from '../../interfaces/models/token';
import admin from '../admin.config';
import { MnemonicService } from '../services/wallet/mnemonic';
import { SmrWallet } from '../services/wallet/SmrWalletService';
import { WalletService } from '../services/wallet/wallet';
import { serverTime, uOn } from '../utils/dateTime.utils';
import { memberDocRef } from '../utils/token.utils';
import { getRandomEthAddress } from '../utils/wallet.utils';
import { getAddress } from './address.utils';

export const creditBuyer = async (buy: TokenBuySellOrder, newPurchase: TokenPurchase[], transaction: admin.firestore.Transaction) => {
  const oldPurchases = (await admin.firestore().collection(COL.TOKEN_PURCHASE).where('buy', '==', buy.uid).get()).docs.map(d => <TokenPurchase>d.data())
  const totalPaid = [...oldPurchases, ...newPurchase].reduce((sum, act) => sum + Number(bigDecimal.floor(bigDecimal.multiply(act.price, act.count))), 0);
  const refundAmount = buy.totalDeposit - totalPaid
  if (!refundAmount) {
    return;
  }

  const member = <Member>(await memberDocRef(buy.owner).get()).data()
  const token = <Token>(await admin.firestore().doc(`${COL.TOKEN}/${buy.token}`).get()).data()
  const order = <Transaction>(await (admin.firestore().doc(`${COL.TRANSACTION}/${buy.orderTransactionId}`).get())).data()
  const tranId = getRandomEthAddress();

  const data = <Transaction>{
    type: TransactionType.CREDIT,
    uid: tranId,
    space: token.space,
    member: member.uid,
    createdOn: serverTime(),
    sourceNetwork: order.sourceNetwork || DEFAULT_NETWORK,
    targetNetwork: order.targetNetwork || DEFAULT_NETWORK,
    payload: {
      type: TransactionCreditType.TOKEN_BUY,
      amount: refundAmount,
      sourceAddress: order.payload.targetAddress,
      targetAddress: getAddress(member.validatedAddress, order.targetNetwork || DEFAULT_NETWORK),
      sourceTransaction: [buy.paymentTransactionId],
      token: token.uid,
      reconciled: true,
      void: false,
      invalidPayment: true
    }
  };
  const docRef = admin.firestore().doc(`${COL.TRANSACTION}/${tranId}`)
  transaction.create(docRef, data)
  transaction.update(admin.firestore().doc(`${COL.TOKEN_MARKET}/${buy.uid}`), uOn({ creditTransactionId: tranId }))
}


export const cancelSale = async (transaction: admin.firestore.Transaction, sale: TokenBuySellOrder, forcedStatus?: TokenBuySellOrderStatus) => {
  const token = <Token>(await admin.firestore().doc(`${COL.TOKEN}/${sale.token}`).get()).data()
  const saleDocRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${sale.uid}`)
  const status = forcedStatus || (sale.fulfilled === 0 ? TokenBuySellOrderStatus.CANCELLED : TokenBuySellOrderStatus.PARTIALLY_SETTLED_AND_CANCELLED)

  transaction.update(saleDocRef, uOn({ status }))

  if (sale.type === TokenBuySellOrderType.SELL) {
    if (token.status === TokenStatus.MINTED) {
      return cancelMintedSell(transaction, sale, token)
    }
    const distributionDocRef = admin.firestore().doc(`${COL.TOKEN}/${sale.token}/${SUB_COL.DISTRIBUTION}/${sale.owner}`)
    const leftForSale = bigDecimal.subtract(sale.count, sale.fulfilled)
    transaction.update(distributionDocRef, uOn({ lockedForSale: admin.firestore.FieldValue.increment(-Number(leftForSale)) }))
  } else {
    await creditBuyer(sale, [], transaction)
  }

  return <TokenBuySellOrder>{ ...sale, status }
}

const cancelMintedSell = async (transaction: admin.firestore.Transaction, sell: TokenBuySellOrder, token: Token) => {
  const sellOrderTran = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${sell.orderTransactionId}`).get()).data()
  const seller = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${sell.owner}`).get()).data()
  const wallet = WalletService.newWallet(token.mintingData?.network!) as SmrWallet
  const mnemonic = await MnemonicService.get(sellOrderTran.payload.targetAddress)
  const fromAddress = await wallet.getIotaAddressDetails(mnemonic)
  const toAddress = getAddress(seller.validatedAddress, token.mintingData?.network!)
  const tokensLeft = sell.count - sell.fulfilled
  const { output } = await wallet.send(fromAddress, toAddress, 0, { amount: HexHelper.fromBigInt256(bigInt(tokensLeft)), id: token.mintingData?.tokenId! })
  const data = <Transaction>{
    type: TransactionType.CREDIT,
    uid: getRandomEthAddress(),
    space: token.space,
    member: seller.uid,
    createdOn: serverTime(),
    sourceNetwork: sellOrderTran.sourceNetwork || DEFAULT_NETWORK,
    targetNetwork: sellOrderTran.targetNetwork || DEFAULT_NETWORK,
    payload: {
      type: TransactionCreditType.TOKEN_BUY,
      amount: Number(output.amount),
      nativeToken: { amount: tokensLeft, id: token.mintingData?.tokenId! },
      sourceAddress: sellOrderTran.payload.targetAddress,
      targetAddress: getAddress(seller.validatedAddress, token.mintingData?.network!),
      sourceTransaction: [sell.paymentTransactionId],
      token: token.uid,
      reconciled: true,
      void: false,
      invalidPayment: true
    },
    ignoreWallet: true
  };
  transaction.create(admin.firestore().doc(`${COL.TRANSACTION}/${data.uid}`), data)
  transaction.update(admin.firestore().doc(`${COL.TOKEN_MARKET}/${sell.uid}`), uOn({ creditTransactionId: data.uid }))
}
