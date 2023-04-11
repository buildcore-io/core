import {
  COL,
  DEFAULT_NETWORK,
  Entity,
  Network,
  Transaction,
  TransactionAwardType,
  TransactionCreditType,
  TransactionOrder,
  TransactionType,
} from '@soonaverse/interfaces';
import { last } from 'lodash';
import { getSnapshot, soonDb } from '../../firebase/firestore/soondb';
import { getAddress } from '../../utils/address.utils';
import { TransactionMatch, TransactionService } from './transaction-service';

export class AddressService {
  constructor(readonly transactionService: TransactionService) {}

  public async handleAddressValidationRequest(
    order: TransactionOrder,
    match: TransactionMatch,
    type: Entity,
  ) {
    const payment = await this.transactionService.createPayment(order, match);
    const credit = await this.transactionService.createCredit(
      TransactionCreditType.ADDRESS_VALIDATION,
      payment,
      match,
    );
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
    const ref = soonDb().doc(`${collection}/${id}`);
    const docData = await ref.get<Record<string, unknown>>();
    const network = credit.network || DEFAULT_NETWORK;
    const currentAddress = getAddress(docData, network);
    const data = { [`validatedAddress.${network}`]: credit.payload.targetAddress };
    if (currentAddress) {
      data.prevValidatedAddresses = soonDb().arrayUnion(currentAddress);
    }
    this.transactionService.push({ ref, data, action: 'update' });
  }
}

const claimBadges = async (member: string, memberAddress: string, network: Network) => {
  let lastDocId = '';
  do {
    const lastDoc = await getSnapshot(COL.TRANSACTION, lastDocId);
    const snap = await soonDb()
      .collection(COL.TRANSACTION)
      .where('network', '==', network)
      .where('type', '==', TransactionType.AWARD)
      .where('member', '==', member)
      .where('ignoreWallet', '==', true)
      .where('payload.type', '==', TransactionAwardType.BADGE)
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

const updateBadgeTransaction = async (transactionId: string, memberAddress: string) =>
  soonDb().runTransaction(async (transaction) => {
    const badgeDocRef = soonDb().doc(`${COL.TRANSACTION}/${transactionId}`);
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
