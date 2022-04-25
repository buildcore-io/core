import * as admin from 'firebase-admin';
import { COL, SUB_COL } from '../../interfaces/models/base';

export const mockWalletReturnValue = <T,>(walletSpy: any, address: string, body: T) =>
  walletSpy.mockReturnValue(Promise.resolve({ address: address, body }));

export const expectThrow = <C, E>(call: C, error: E) => {
  (<any>expect(call)).rejects.toThrowError(error)
}

export const milestoneProcessed = async (nextMilestone: string, defTranId: string) => {
  for (let attempt = 0; attempt < 400; ++attempt) {
    await new Promise((r) => setTimeout(r, 500));
    const doc = await admin.firestore().doc(`${COL.MILESTONE}/${nextMilestone}/${SUB_COL.TRANSACTIONS}/${defTranId}`).get();
    if (doc.data()?.processed) {
      return
    }
  }
  throw new Error("Milestone was not processed. Id: " + nextMilestone);
}
