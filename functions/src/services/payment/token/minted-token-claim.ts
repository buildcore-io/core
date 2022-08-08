import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import { isEmpty } from 'lodash';
import { WenError } from '../../../../interfaces/errors';
import { Member, Token, TokenDistribution } from '../../../../interfaces/models';
import { COL, SUB_COL } from '../../../../interfaces/models/base';
import { Transaction, TransactionOrder, TransactionType } from '../../../../interfaces/models/transaction';
import admin from '../../../admin.config';
import { getAddress } from '../../../utils/address.utils';
import { serverTime } from '../../../utils/dateTime.utils';
import { getRandomEthAddress } from '../../../utils/wallet.utils';
import { SmrWallet } from '../../wallet/SmrWalletService';
import { WalletService } from '../../wallet/wallet';
import { TransactionMatch, TransactionService } from '../transaction-service';
import { distributionToDrops, dropToOutput } from './mint-utils/member.utils';

export class MintedTokenClaimService {

  constructor(readonly transactionService: TransactionService) { }

  public handleClaimRequest = async (order: TransactionOrder, match: TransactionMatch) => {
    const payment = this.transactionService.createPayment(order, match);

    const distributionDocRef = admin.firestore().doc(`${COL.TOKEN}/${order.payload.token}/${SUB_COL.DISTRIBUTION}/${order.member}`)
    const distribution = <TokenDistribution | undefined>(await this.transactionService.transaction.get(distributionDocRef)).data()

    const drops = distributionToDrops(distribution)
    if (distribution?.mintedClaimedOn || isEmpty(drops)) {
      functions.logger.warn(WenError.no_tokens_to_claim.key, order.uid)
      this.transactionService.createCredit(payment, match);
      return;
    }
    await this.transactionService.markAsReconciled(order, match.msgId)

    const wallet = await WalletService.newWallet(order.targetNetwork!) as SmrWallet
    const info = await wallet.client.info()
    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${order.payload.token}`)
    const token = <Token>(await this.transactionService.transaction.get(tokenDocRef)).data()
    const member = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${order.member}`).get()).data()
    const memberAddress = getAddress(member, order.targetNetwork!)

    const transactions = drops
      .map(d => {
        const output = dropToOutput(token, d, memberAddress, info);
        return <Transaction>{
          type: TransactionType.BILL_PAYMENT,
          uid: getRandomEthAddress(),
          space: token.space,
          member: order.member,
          createdOn: serverTime(),
          sourceNetwork: order.sourceNetwork,
          targetNetwork: order.targetNetwork,
          payload: {
            amount: Number(output.amount),
            nativeTokens: [{
              id: output.nativeTokens![0].id,
              amount: Number(output.nativeTokens![0].amount)
            }],
            storageDepositSourceAddress: order.payload.targetAddress,
            vestingAt: dayjs(d.vestingAt.toDate()).isAfter(dayjs()) ? d.vestingAt : null,
            sourceAddress: token.mintingData?.vaultAddress!,
            targetAddress: memberAddress,
            sourceTransaction: [payment.uid],
            token: token.uid,
            quantity: Number(output.nativeTokens![0].amount)
          }
        }
      })
    transactions.forEach((t, i, array) => {
      const ref = admin.firestore().doc(`${COL.TRANSACTION}/${t.uid}`)
      const data = i ? { ...t, dependsOn: array[i - 1].uid } : t
      this.transactionService.updates.push({ ref, data, action: 'set' })
    })
    const data = { mintedClaimedOn: serverTime(), mintingTransactions: transactions.map(t => t.uid) }
    this.transactionService.updates.push({ ref: distributionDocRef, data, action: 'update' })

    const totalClaimed = drops.reduce((acc, act) => acc + act.count, 0)
    this.transactionService.updates.push({
      ref: tokenDocRef,
      data: { 'mintingData.tokensInVault': admin.firestore.FieldValue.increment(-totalClaimed) },
      action: 'update'
    })

    if (token.mintingData?.tokensInVault! === totalClaimed) {
      const vaultBalance = await wallet.getBalance(token.mintingData?.vaultAddress!)
      const minter = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${token.mintingData?.mintedBy}`).get()).data()
      const paymentsSnap = await admin.firestore().collection(COL.TRANSACTION)
        .where('payload.sourceTransaction', 'array-contains', token.mintingData?.vaultAddress!)
        .where('type', '==', TransactionType.PAYMENT)
        .get()
      const data = <Transaction>{
        type: TransactionType.CREDIT,
        uid: getRandomEthAddress(),
        space: token.space,
        member: minter.uid,
        createdOn: serverTime(),
        sourceNetwork: order.sourceNetwork,
        targetNetwork: order.targetNetwork,
        payload: {
          amount: vaultBalance,
          sourceAddress: token.mintingData?.vaultAddress!,
          targetAddress: getAddress(minter, token.mintingData?.network!),
          sourceTransaction: paymentsSnap.docs.map(d => d.id),
          token: token.uid
        }
      }
      this.transactionService.updates.push({ ref: admin.firestore().doc(`${COL.TRANSACTION}/${data.uid}`), data, action: 'set' })
    }
  }
}

