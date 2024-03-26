import { build5Db } from '@build-5/database';
import {
  COL,
  DEFAULT_NETWORK,
  Entity,
  Network,
  NetworkAddress,
  TransactionPayloadType,
  TransactionType,
} from '@build-5/interfaces';
import { HandlerParams } from '../base';
import { BaseAddressService } from './common';

export class MemberAddressService extends BaseAddressService {
  public handleRequest = async ({ order, match }: HandlerParams) => {
    const payment = await this.transactionService.createPayment(order, match);
    const credit = await this.transactionService.createCredit(
      TransactionPayloadType.ADDRESS_VALIDATION,
      payment,
      match,
    );
    if (credit) {
      await this.setValidatedAddress(credit, Entity.MEMBER);
      await this.claimBadges(
        order.member!,
        credit.payload.targetAddress!,
        order.network || DEFAULT_NETWORK,
      );
    }
    this.transactionService.markAsReconciled(order, match.msgId);
  };

  private claimBadges = async (member: string, memberAddress: NetworkAddress, network: Network) => {
    const snap = await build5Db()
      .collection(COL.TRANSACTION)
      .where('network', '==', network)
      .where('type', '==', TransactionType.AWARD)
      .where('member', '==', member)
      .where('ignoreWallet', '==', true)
      .where('payload_type', '==', TransactionPayloadType.BADGE)
      .get();

    const promises = snap.map((badgeTransaction) =>
      updateBadgeTransaction(badgeTransaction.uid, memberAddress),
    );
    await Promise.all(promises);
  };
}

const updateBadgeTransaction = (transactionId: string, memberAddress: NetworkAddress) =>
  build5Db().runTransaction(async (transaction) => {
    const badgeDocRef = build5Db().doc(COL.TRANSACTION, transactionId);
    const badge = await transaction.get(badgeDocRef);
    if (badge?.ignoreWallet) {
      const data = {
        ignoreWallet: false,
        payload_targetAddress: memberAddress,
        shouldRetry: true,
      };
      await transaction.update(badgeDocRef, data);
    }
  });
