import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import { isEmpty } from 'lodash';
import { DEFAULT_NETWORK } from '../../../../interfaces/config';
import { WenError } from '../../../../interfaces/errors';
import { Member, Token, TokenDistribution } from '../../../../interfaces/models';
import { COL, SUB_COL } from '../../../../interfaces/models/base';
import {
  Entity,
  Transaction,
  TransactionOrder,
  TransactionType,
} from '../../../../interfaces/models/transaction';
import admin from '../../../admin.config';
import { getAddress } from '../../../utils/address.utils';
import { serverTime } from '../../../utils/dateTime.utils';
import { distributionToDrops, dropToOutput } from '../../../utils/token-minting-utils/member.utils';
import { getRandomEthAddress } from '../../../utils/wallet.utils';
import { SmrWallet } from '../../wallet/SmrWalletService';
import { WalletService } from '../../wallet/wallet';
import { TransactionMatch, TransactionService } from '../transaction-service';

export class MintedTokenClaimService {
  constructor(readonly transactionService: TransactionService) {}

  public handleClaimRequest = async (order: TransactionOrder, match: TransactionMatch) => {
    const payment = this.transactionService.createPayment(order, match);

    const distributionDocRef = admin
      .firestore()
      .doc(`${COL.TOKEN}/${order.payload.token}/${SUB_COL.DISTRIBUTION}/${order.member}`);
    const distribution = <TokenDistribution | undefined>(
      (await this.transactionService.transaction.get(distributionDocRef)).data()
    );

    const drops = distributionToDrops(distribution);
    if (distribution?.mintedClaimedOn || isEmpty(drops)) {
      functions.logger.warn(WenError.no_tokens_to_claim.key, order.uid);
      this.transactionService.createCredit(payment, match);
      return;
    }
    await this.transactionService.markAsReconciled(order, match.msgId);

    const wallet = (await WalletService.newWallet(order.network || DEFAULT_NETWORK)) as SmrWallet;
    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${order.payload.token}`);
    const token = <Token>(await this.transactionService.transaction.get(tokenDocRef)).data();
    const member = <Member>(
      (await admin.firestore().doc(`${COL.MEMBER}/${order.member}`).get()).data()
    );
    const memberAddress = getAddress(member, order.network || DEFAULT_NETWORK);

    const billPayments = drops.map((drop) => {
      const output = dropToOutput(token, drop, memberAddress, wallet.info);
      return <Transaction>{
        type: TransactionType.BILL_PAYMENT,
        uid: getRandomEthAddress(),
        space: token.space,
        member: order.member,
        createdOn: serverTime(),
        network: order.network || DEFAULT_NETWORK,
        payload: {
          amount: Number(output.amount),
          nativeTokens: [
            {
              id: output.nativeTokens![0].id,
              amount: Number(output.nativeTokens![0].amount),
            },
          ],
          previousOwnerEntity: Entity.SPACE,
          previousOwner: token.space,
          ownerEntity: Entity.MEMBER,
          owner: order.member,
          storageDepositSourceAddress: order.payload.targetAddress,
          vestingAt: dayjs(drop.vestingAt.toDate()).isAfter(dayjs()) ? drop.vestingAt : null,
          sourceAddress: token.mintingData?.vaultAddress!,
          targetAddress: memberAddress,
          sourceTransaction: [payment.uid],
          token: token.uid,
          quantity: Number(output.nativeTokens![0].amount),
        },
      };
    });
    billPayments.forEach((billPayment) => {
      const ref = admin.firestore().doc(`${COL.TRANSACTION}/${billPayment.uid}`);
      this.transactionService.updates.push({ ref, data: billPayment, action: 'set' });
    });
    const data = {
      mintedClaimedOn: serverTime(),
      mintingTransactions: billPayments.map((t) => t.uid),
    };
    this.transactionService.updates.push({ ref: distributionDocRef, data, action: 'update' });

    const totalClaimed = drops.reduce((acc, act) => acc + act.count, 0);
    this.transactionService.updates.push({
      ref: tokenDocRef,
      data: { 'mintingData.tokensInVault': admin.firestore.FieldValue.increment(-totalClaimed) },
      action: 'update',
    });

    if (token.mintingData?.tokensInVault! === totalClaimed) {
      const vaultBalance = await wallet.getBalance(token.mintingData?.vaultAddress!);
      const minter = <Member>(
        (await admin.firestore().doc(`${COL.MEMBER}/${token.mintingData?.mintedBy}`).get()).data()
      );
      const paymentsSnap = await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('payload.sourceTransaction', 'array-contains', token.mintingData?.vaultAddress!)
        .where('type', '==', TransactionType.PAYMENT)
        .get();
      const data = <Transaction>{
        type: TransactionType.CREDIT,
        uid: getRandomEthAddress(),
        space: token.space,
        member: minter.uid,
        createdOn: serverTime(),
        network: order.network || DEFAULT_NETWORK,
        payload: {
          dependsOnBillPayment: true,
          amount: vaultBalance,
          sourceAddress: token.mintingData?.vaultAddress!,
          targetAddress: getAddress(minter, token.mintingData?.network!),
          sourceTransaction: paymentsSnap.docs.map((d) => d.id),
          token: token.uid,
        },
      };
      this.transactionService.updates.push({
        ref: admin.firestore().doc(`${COL.TRANSACTION}/${data.uid}`),
        data,
        action: 'set',
      });
    }
  };
}
