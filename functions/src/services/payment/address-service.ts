import { Transaction } from '../../../interfaces/models';
import { COL } from '../../../interfaces/models/base';
import { CreditPaymentTransaction, Entity, TransactionOrder } from '../../../interfaces/models/transaction';
import admin from '../../admin.config';
import { TransactionMatch, TransactionService } from './transaction-service';


export class AddressService {
  constructor(readonly transactionService: TransactionService) { }

  public async handleAddressValidationRequest(orderData: TransactionOrder, match: TransactionMatch, type: Entity) {
    // Found transaction, create payment / ( bill payments | credit)
    const payment = this.transactionService.createPayment(orderData, match);
    const credit = this.transactionService.createCredit(payment, match);
    if (credit) {
      await this.setValidatedAddress(credit, type);
    }
    await this.transactionService.markAsReconciled(orderData, match.msgId);
  }

  private async setValidatedAddress(credit: Transaction, type: Entity): Promise<void> {
    if (type === 'member' && credit.member) {
      const refSource = admin.firestore().collection(COL.MEMBER).doc(credit.member);
      const sfDoc = await this.transactionService.transaction.get(refSource);
      if (sfDoc.data()) {
        this.transactionService.pushUpdate({
          ref: refSource,
          data: {
            validatedAddress: (<CreditPaymentTransaction>credit.payload).targetAddress
          },
          action: 'update'
        });
      }
    } else if (type === 'space' && credit.space) {
      const refSource = admin.firestore().collection(COL.SPACE).doc(credit.space);
      const sfDoc = await this.transactionService.transaction.get(refSource);
      if (sfDoc.data()) {
        this.transactionService.pushUpdate({
          ref: refSource,
          data: {
            validatedAddress: (<CreditPaymentTransaction>credit.payload).targetAddress
          },
          action: 'update'
        });
      }
    }
  }

}
