import {
  COL,
  DEFAULT_NETWORK,
  Entity,
  Network,
  Transaction,
  TransactionAwardType,
  TransactionOrder,
  TransactionType,
} from '@soonaverse/interfaces';
import admin, { arrayUnion } from '../../admin.config';
import { Database, TransactionRunner } from '../../database/Database';
import { getAddress } from '../../utils/address.utils';
import { TransactionMatch, TransactionService } from './transaction-service';

export class AddressService {
  constructor(readonly transactionService: TransactionService) {}

  public async handleAddressValidationRequest(
    order: TransactionOrder,
    match: TransactionMatch,
    type: Entity,
  ) {
    const payment = this.transactionService.createPayment(order, match);
    const credit = this.transactionService.createCredit(payment, match);
    if (credit) {
      await this.setValidatedAddress(credit, type);
      if (type === Entity.MEMBER) {
        await claimBadges(
          order.member!,
          credit.payload.targetAddress,
          order.network || DEFAULT_NETWORK,
        );
      }
    }
    this.transactionService.markAsReconciled(order, match.msgId);
  }

  private async setValidatedAddress(credit: Transaction, type: Entity): Promise<void> {
    const collection = type === Entity.MEMBER ? COL.MEMBER : COL.SPACE;
    const id = type === Entity.MEMBER ? credit.member : credit.space;
    const ref = admin.firestore().doc(`${collection}/${id}`);
    const docData = (await ref.get()).data();
    const network = credit.network || DEFAULT_NETWORK;
    const currentAddress = getAddress(docData, network);
    const data = { [`validatedAddress.${network}`]: credit.payload.targetAddress };
    if (currentAddress) {
      data.prevValidatedAddresses = arrayUnion(currentAddress);
    }
    this.transactionService.updates.push({ ref, data, action: 'update' });
  }
}

const claimBadges = async (member: string, memberAddress: string, network: Network) =>
  Database.getManyPaginated<Transaction>(COL.TRANSACTION, {
    network,
    type: TransactionType.AWARD,
    member,
    ignoreWallet: true,
    'payload.type': TransactionAwardType.BADGE,
  })(async (data) => updateBadgeTransactions(data, memberAddress));

const updateBadgeTransactions = async (badgeTransactions: Transaction[], memberAddress: string) => {
  const promises = badgeTransactions.map((badgeTransaction) =>
    updateBadgeTransaction(badgeTransaction.uid, memberAddress),
  );
  await Promise.all(promises);
};

const updateBadgeTransaction = async (transactionId: string, memberAddress: string) =>
  TransactionRunner.runTransaction(async (transaction) => {
    const badge = await transaction.getById<Transaction>(COL.TRANSACTION, transactionId);
    if (badge?.ignoreWallet) {
      const data = {
        uid: transactionId,
        ignoreWallet: false,
        'payload.targetAddress': memberAddress,
        shouldRetry: true,
      };
      transaction.update({ col: COL.TRANSACTION, data, action: 'update' });
    }
  });
