import {
  COL,
  DEFAULT_NETWORK,
  Entity,
  Transaction,
  TransactionOrder,
} from '@soonaverse/interfaces';
import admin, { arrayUnion } from '../../admin.config';
import { getAddress } from '../../utils/address.utils';
import { TransactionMatch, TransactionService } from './transaction-service';

export class AddressService {
  constructor(readonly transactionService: TransactionService) {}

  public async handleAddressValidationRequest(
    orderData: TransactionOrder,
    match: TransactionMatch,
    type: Entity,
  ) {
    const payment = this.transactionService.createPayment(orderData, match);
    const credit = this.transactionService.createCredit(payment, match);
    if (credit) {
      await this.setValidatedAddress(credit, type);
    }
    await this.transactionService.markAsReconciled(orderData, match.msgId);
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
