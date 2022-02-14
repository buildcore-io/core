import * as functions from 'firebase-functions';
import { Change } from "firebase-functions";
import { DocumentSnapshot } from "firebase-functions/v1/firestore";
import { Transaction, TransactionType, WalletResult } from '../../interfaces/models';
import { COL } from '../../interfaces/models/base';
import { MnemonicService } from "../services/wallet/mnemonic";
import { WalletService } from "../services/wallet/wallet";
import { serverTime } from "../utils/dateTime.utils";

// Listen for changes in all documents in the 'users' collection
export const transactionWrite: functions.CloudFunction<Change<DocumentSnapshot>> = functions.runWith({
  timeoutSeconds: 300,
  memory: "8GB",
}).firestore.document(COL.TRANSACTION + '/{tranId}').onWrite(async (change) => {
  const newValue: Transaction = <Transaction>change.after.data();
  if (!newValue || (newValue.type !== TransactionType.CREDIT && newValue.type !== TransactionType.BILL_PAYMENT)) {
    return;
  }

  if (!newValue.payload.walletReference) {
    const walletService: WalletService = new WalletService();
    const walletResponse: WalletResult = {
      createdOn: serverTime()
    };

    // Delay required.
    if (newValue.payload.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, newValue.payload.delay));
    }

    try {
      walletResponse.chainReference = await walletService.sendFromGenesis(
        await walletService.getIotaAddressDetails(await MnemonicService.get(newValue.payload.sourceAddress)),
        newValue.payload.targetAddress,
        newValue.payload.amount,

        // TODO What we want to add to tangle.
        JSON.stringify({
          amazing: 'soon'
        })
      );
    } catch (e: any) {
      walletResponse.error = e.toString();
    }

    // Set wallet reference.
    newValue.payload.walletReference = walletResponse;
    return change.after.ref.set(newValue, {merge: true});
  } else {
    console.log('Nothing to process.');
    return;
  }
});
