import dayjs from 'dayjs';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { Change } from "firebase-functions";
import { DocumentSnapshot } from "firebase-functions/v1/firestore";
import { Transaction, TRANSACTION_AUTO_EXPIRY_MS } from '../../interfaces/models';
import { COL } from '../../interfaces/models/base';
import { MnemonicService } from "../services/wallet/mnemonic";
import { serverTime } from "../utils/dateTime.utils";
import { getRandomEthAddress } from "../utils/wallet.utils";
import { EthAddress } from './../../interfaces/models/base';
import { MilestoneTransaction, MilestoneTransactionEntry } from './../../interfaces/models/milestone';
import { TransactionOrderType, TransactionType } from './../../interfaces/models/transaction';
import { WalletService } from './../services/wallet/wallet';

interface TransactionMatch {
  msgId: string;
  from: MilestoneTransactionEntry;
  to: MilestoneTransactionEntry;
}

class ProcessingService {
  public walletOperations: Promise<any>[] = [];
  private walletService: WalletService;
  private trans: {
    [propName: string]: MilestoneTransaction;
  };
  constructor(trans: {
    [propName: string]: MilestoneTransaction;
  }) {
    this.trans = trans;
    this.walletService = new WalletService();
  }

  private getTransactions(type: TransactionType): any {
    return admin.firestore().collection(COL.TRANSACTION).where('type', '==', type).where('reconciled', '==', false).where('void', '!=', true);
  }

  private findMatch(toAddress: string, amount: number, exact = true): TransactionMatch | undefined {
    let found: TransactionMatch | undefined;
    for (const [msgId, t] of Object.entries(this.trans)) {
      const fromAddress: MilestoneTransactionEntry = t.inputs[0];
      for (const o of t.outputs) {
        if (
          (o.address === toAddress && amount === amount && exact == true) ||
          (o.address === toAddress && exact === false)
        ) {
          found = {
            msgId: msgId,
            from: fromAddress,
            to: o
          };
        }
      }
    }

    return found;
  }

  private actionNotRequired(): boolean {
    return Object.keys(this.trans).length === 0;
  }

  private markAsReconciled(uid: string, chainRef: string): Promise<any> {
    return admin.firestore().collection(COL.TRANSACTION).doc(uid).update({
      reconciled: true,
      chainReference: chainRef
    });
  }

  private markAsVoid(uid: string): Promise<any> {
    return admin.firestore().collection(COL.TRANSACTION).doc(uid).update({
      void: true
    });
  }

  private async createPayment(order: Transaction, tran: TransactionMatch): Promise<Transaction> {
    if (order.type !== TransactionType.ORDER) {
      throw new Error('Order was not provided as transaction.');
    }

    const tranId: string = getRandomEthAddress();
    const refTran: any = admin.firestore().collection(COL.TRANSACTION).doc(tranId);
    await refTran.set(<Transaction>{
      type: TransactionType.PAYMENT,
      uid: tranId,
      member: order.member,
      space: order.space,
      createdOn: serverTime(),
      payload: {
        amount: order.payload.amount,
        sourceAddress: tran.from.address,
        targetAddress: order.payload.targetAddress,
        reconciled: true,
        sourceTransaction: order.uid,
        chainReference: tran.msgId,
        nft: order.payload.nft,
        collection: order.payload.collection
      }
    });

    // Update reference on order.
    const refSource: any = admin.firestore().collection(COL.TRANSACTION).doc(order.uid);
    const refData: any = await refSource.get();
    const linkedTransactions: EthAddress[] = refData.data().linkedTransactions || [];
    linkedTransactions.push(tranId);
    await refSource.update({
      linkedTransactions: linkedTransactions
    });

    return refTran.get().data();
  }

  private async createBillPayment(order: Transaction, tran: TransactionMatch): Promise<Transaction[]> {
    if (order.type !== TransactionType.ORDER) {
      throw new Error('Order was not provided as transaction.');
    }

    // Calculate royalties.
    const transOut: Transaction[] = [];
    const royaltyAmt: number = order.payload.royaltiesSpaceAddress ? (order.payload.amount * order.payload.royaltiesFee) : 0;
    const finalAmt: number = order.payload.amount - royaltyAmt;

    // Update reference on order.
    const refSource: any = admin.firestore().collection(COL.TRANSACTION).doc(order.uid);
    const refData: any = await refSource.get();
    const linkedTransactions: EthAddress[] = refData.data().linkedTransactions || [];

    // Pay roaylties.
    if (royaltyAmt > 0) {
      const tranId: string = getRandomEthAddress();
      const refTran: any = admin.firestore().collection(COL.TRANSACTION).doc(tranId);
      const data: any = <Transaction>{
        type: TransactionType.BILL_PAYMENT,
        uid: tranId,
        member: order.member,
        space: order.payload.royaltiesSpace,
        createdOn: serverTime(),
        payload: {
          amount: order.payload.amount,
          sourceAddress: tran.to.address,
          targetAddress: order.payload.royaltiesSpaceAddress,
          sourceTransaction: order.uid,
          reconciled: false,
          nft: order.payload.nft,
          collection: order.payload.collection
        }
      };
      transOut.push(await refTran.set(data));

      linkedTransactions.push(tranId);

      // Non blocking!!
      this.walletOperations.push(this.walletService.sendFromGenesis(
        await this.walletService.getIotaAddressDetails(await MnemonicService.get(tran.to.address)),
        order.payload.royaltiesSpaceAddress,
        order.payload.amount,
        JSON.stringify(data)
      ));
    }

    if (finalAmt > 0) {
      const tranId: string = getRandomEthAddress();
      const refTran: any = admin.firestore().collection(COL.TRANSACTION).doc(tranId);
      const data: any = <Transaction>{
        type: TransactionType.BILL_PAYMENT,
        uid: tranId,
        space: order.payload.beneficiary !== 'member' ? order.space : null,
        member: order.member,
        createdOn: serverTime(),
        payload: {
          amount: order.payload.amount,
          sourceAddress: tran.to.address,
          targetAddress: order.payload.beneficiaryAddress,
          sourceTransaction: order.uid,
          nft: order.payload.nft,
          reconciled: false,
          collection: order.payload.collection
        }
      };
      transOut.push(await refTran.set(data));

      linkedTransactions.push(tranId);

      // Non blocking!!
      this.walletOperations.push(this.walletService.sendFromGenesis(
        await this.walletService.getIotaAddressDetails(await MnemonicService.get(tran.to.address)),
        order.payload.beneficiaryAddress,
        order.payload.amount,
        JSON.stringify(data)
      ));
    }

    // Update links on the order.
    await refSource.update({
      linkedTransactions: linkedTransactions
    });

    return transOut;
  }

  private async createCredit(order: Transaction, payment: Transaction, tran: TransactionMatch): Promise<Transaction|undefined> {
    if (order.type !== TransactionType.ORDER) {
      throw new Error('Order was not provided as transaction.');
    }

    if (payment.type !== TransactionType.PAYMENT) {
      throw new Error('Payment was not provided as transaction.');
    }
    let transOut: Transaction|undefined;

    // Update reference on order.
    const refSource: any = admin.firestore().collection(COL.TRANSACTION).doc(order.uid);
    const refData: any = await refSource.get();
    const linkedTransactions: EthAddress[] = refData.data().linkedTransactions || [];

    if (payment.payload.amount > 0) {
      const tranId: string = getRandomEthAddress();
      const refTran: any = admin.firestore().collection(COL.TRANSACTION).doc(tranId);
      const data: any = <Transaction>{
        type: TransactionType.CREDIT,
        uid: tranId,
        space: order.space,
        member: order.member,
        createdOn: serverTime(),
        payload: {
          amount: order.payload.amount,
          sourceAddress: tran.to.address,
          targetAddress: tran.from.address,
          sourceTransaction: payment.uid,
          nft: order.payload.nft,
          reconciled: false,
          collection: order.payload.collection
        }
      };
      transOut = await refTran.set(data);

      linkedTransactions.push(tranId);

      // Non blocking!!
      this.walletOperations.push(this.walletService.sendFromGenesis(
        await this.walletService.getIotaAddressDetails(await MnemonicService.get(tran.to.address)),
        tran.from.address,
        order.payload.amount,
        JSON.stringify(data)
      ));
    }

    // Update links on the order.
    await refSource.update({
      linkedTransactions: linkedTransactions
    });

    return transOut;
  }

  private async setValidatedAddress(credit: Transaction, type: 'member'|'space'): Promise<void> {
    if (type === 'member' && credit.member) {
      await admin.firestore().collection(COL.MEMBER).doc(credit.member).update({
        validatedAddress: credit.payload.targetAddress
      });
    } else if (type === 'space' && credit.space) {
      await admin.firestore().collection(COL.SPACE).doc(credit.space).update({
        validatedAddress: credit.payload.targetAddress
      });
    }
  }

  public async processOrders(): Promise<void> {
    if (!this.actionNotRequired()) {
      return;
    }

    const pendingTrans: any = this.getTransactions(TransactionType.ORDER);
    for (const pendingTran of pendingTrans.docs) {
      // This happens here on purpose instead of cron to reduce $$$
      if (dayjs(pendingTran.data().createdOn.toDate()).isAfter(dayjs().add(TRANSACTION_AUTO_EXPIRY_MS, 'ms'))) {
        await this.markAsVoid(pendingTran.data().uid);
        continue;
      }

      const match: TransactionMatch | undefined = this.findMatch(pendingTran.data().payload.targetAddress, pendingTran.data().payload.amount);
      if (match) {
        // Found transaction, create payment / ( bill payments | credit)
        const payment = await this.createPayment(pendingTran.data(), match);
        if (pendingTran.data().payload.type === TransactionOrderType.NFT_PURCHASE) {
          await this.createBillPayment(pendingTran.data(), match);
          await this.createBillPayment(pendingTran.data(), match);
          // TODO Set new owner of the NFT and remove availableFrom.
        } else if (pendingTran.data().payload.type === TransactionOrderType.SPACE_ADDRESS_VALIDATION) {
          const credit = await this.createCredit(pendingTran.data(), payment, match);
          if (credit) {
            await this.setValidatedAddress(credit, 'space');
          }
        } else if (pendingTran.data().payload.type === TransactionOrderType.MEMBER_ADDRESS_VALIDATION) {
          const credit = await this.createCredit(pendingTran.data(), payment, match);
          if (credit) {
            await this.setValidatedAddress(credit, 'member');
          }
        }

        await this.markAsReconciled(pendingTran.data().uid, match.msgId);
      }

      const wrongTran: TransactionMatch | undefined = this.findMatch(pendingTran.data().payload.targetAddress, pendingTran.data().payload.amount, false);
      if (wrongTran) {
        // Found wrong transaction - refund credit
        const payment = await this.createPayment(pendingTran.data(), wrongTran);
        await this.createCredit(pendingTran.data(), payment, wrongTran);
      }
    }
    return;
  }

  public async processBillPayments(): Promise<void> {
    if (!this.actionNotRequired()) {
      return;
    }

    const pendingTrans: any =  this.getTransactions(TransactionType.BILL_PAYMENT);
    for (const pendingTran of pendingTrans.docs) {
      const match: TransactionMatch | undefined = this.findMatch(pendingTran.data().payload.targetAddress, pendingTran.data().payload.amount);
      if (match) {
        await this.markAsReconciled(pendingTran.data().uid, match.msgId);
      }
    }
    return;
  }

  public async processCredits(): Promise<void> {
    if (!this.actionNotRequired()) {
      return;
    }

    const pendingTrans: any =  this.getTransactions(TransactionType.CREDIT);
    for (const pendingTran of pendingTrans.docs) {
      const match: TransactionMatch | undefined = this.findMatch(pendingTran.payload.targetAddress, pendingTran.payload.amount);
      if (match) {
        await this.markAsReconciled(pendingTran.uid, match.msgId);
      }
    }
    return;
  }

}

// Listen for changes in all documents in the 'users' collection
export const milestoneWrite: functions.CloudFunction<Change<DocumentSnapshot>> = functions.firestore.document(COL.MILESTONE + '/{milestoneId}').onWrite(async (change) => {
  const newValue: any = change.after.data();
  const previousValue: any = change.before.data();
  if ((!previousValue || previousValue.complete === false) && previousValue?.processed !== true && newValue.complete === true) {
    // We need to scan ALL transactions with certain type.
    if (newValue.transactions) {
      const service: ProcessingService = new ProcessingService(newValue.transactions);
      await service.processOrders();
      await service.processBillPayments();
      await service.processCredits();
    }

    // Mark milestone as processed.
    return change.after.ref.set({
      processed: true
    }, {merge: true});
  } else {
    console.log('Nothing to process.');
    return;
  }
});
