import {
    COL,
    DEFAULT_NETWORK,
    Entity,
    Member,
    SUB_COL,
    Token,
    TokenDistribution,
    Transaction,
    TransactionOrder,
    TransactionType
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { groupBy, isEmpty } from 'lodash';
import admin from '../../../admin.config';
import { getAddress } from '../../../utils/address.utils';
import { distributionToDrops, dropToOutput } from '../../../utils/token-minting-utils/member.utils';
import { getRandomEthAddress } from '../../../utils/wallet.utils';
import { SmrWallet } from '../../wallet/SmrWalletService';
import { WalletService } from '../../wallet/wallet';
import { TransactionMatch, TransactionService } from '../transaction-service';

export class MintedTokenClaimService {
  constructor(readonly transactionService: TransactionService) {}

  public handleClaimRequest = async (order: TransactionOrder, match: TransactionMatch) => {
    const payment = this.transactionService.createPayment(order, match);

    const wallet = (await WalletService.newWallet(order.network || DEFAULT_NETWORK)) as SmrWallet;
    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${order.payload.token}`);
    const token = <Token>(await this.transactionService.transaction.get(tokenDocRef)).data();

    const distributionDocRef = admin
      .firestore()
      .doc(`${COL.TOKEN}/${order.payload.token}/${SUB_COL.DISTRIBUTION}/${order.member}`);
    const distribution = <TokenDistribution | undefined>(
      (await this.transactionService.transaction.get(distributionDocRef)).data()
    );

    const drops = distributionToDrops(distribution);
    const storageDeposit = drops.reduce(
      (acc, drop) =>
        acc + Number(dropToOutput(token, drop, order.payload.targetAddress, wallet.info).amount),
      0,
    );
    if (isEmpty(drops) || order.payload.amount !== storageDeposit) {
      this.transactionService.createCredit(payment, match);
      return;
    }
    await this.transactionService.markAsReconciled(order, match.msgId);

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
          sourceAddress: drop.sourceAddress || token.mintingData?.vaultAddress!,
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
      mintedClaimedOn: admin.firestore.FieldValue.serverTimestamp(),
      mintingTransactions: admin.firestore.FieldValue.arrayUnion(...billPayments.map((t) => t.uid)),
      tokenDrops: admin.firestore.FieldValue.arrayRemove(...drops),
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

    const groups = groupBy(
      drops.filter((d) => !isEmpty(d.sourceAddress)),
      (d) => d.orderId,
    );
    Object.entries(groups).forEach(([orderId, drops]) => {
      const orderDrops = drops.map((d) => ({
        count: d.count,
        recipient: order.member,
        vestingAt: d.vestingAt,
      }));
      this.transactionService.updates.push({
        ref: admin.firestore().doc(`${COL.TRANSACTION}/${orderId}`),
        data: { 'payload.drops': admin.firestore.FieldValue.arrayRemove(...orderDrops) },
        action: 'update',
      });
    });
  };
}
