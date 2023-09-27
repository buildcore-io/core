import { build5Db, getSnapshot } from '@build-5/database';
import {
  COL,
  DEFAULT_NETWORK,
  Entity,
  Network,
  NetworkAddress,
  Transaction,
  TransactionPayloadType,
  TransactionType,
} from '@build-5/interfaces';
import { last } from 'lodash';
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
      await claimBadges(
        order.member!,
        credit.payload.targetAddress!,
        order.network || DEFAULT_NETWORK,
      );
    }
    this.transactionService.markAsReconciled(order, match.msgId);
  };
}

const claimBadges = async (member: string, memberAddress: NetworkAddress, network: Network) => {
  let lastDocId = '';
  do {
    const lastDoc = await getSnapshot(COL.TRANSACTION, lastDocId);
    const snap = await build5Db()
      .collection(COL.TRANSACTION)
      .where('network', '==', network)
      .where('type', '==', TransactionType.AWARD)
      .where('member', '==', member)
      .where('ignoreWallet', '==', true)
      .where('payload.type', '==', TransactionPayloadType.BADGE)
      .limit(500)
      .startAfter(lastDoc)
      .get<Transaction>();
    lastDocId = last(snap)?.uid || '';

    const promises = snap.map((badgeTransaction) =>
      updateBadgeTransaction(badgeTransaction.uid, memberAddress),
    );
    await Promise.all(promises);
  } while (lastDocId);
};

const updateBadgeTransaction = async (transactionId: string, memberAddress: NetworkAddress) =>
  build5Db().runTransaction(async (transaction) => {
    const badgeDocRef = build5Db().doc(`${COL.TRANSACTION}/${transactionId}`);
    const badge = await transaction.get<Transaction>(badgeDocRef);
    if (badge?.ignoreWallet) {
      const data = {
        ignoreWallet: false,
        'payload.targetAddress': memberAddress,
        shouldRetry: true,
      };
      transaction.update(badgeDocRef, data);
    }
  });
