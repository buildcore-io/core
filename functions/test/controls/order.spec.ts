// import * as admin from 'firebase-admin';
// import { TransactionOrderType, TransactionType } from 'functions/interfaces/models';
// import { COL } from 'functions/interfaces/models/base';
// import { createSpace } from 'functions/src/controls/space.control';
// import * as wallet from '../../src/utils/wallet.utils';
// import { testEnv } from '../set-up';
// import { createMember } from './../../src/controls/member.control';
// import { validateAddress } from './../../src/controls/order.control';
// const db = admin.firestore();

// describe('Ordering flows', () => {
//   let walletSpy: any;

//   const milestoneProcessed: any = async (nextMilestone: string) => {
//     let processed: any = false;
//     for (let attempt = 0; attempt < 20; ++attempt) {
//         if (attempt > 0) {
//           await new Promise((r) => setTimeout(r, 500));
//         }
//         try {
//           const unsub: any = await db.collection(COL.MILESTONE).doc(nextMilestone).onSnapshot(async (snap: any) => {
//             if (snap.data().processed === true) {
//               processed = true;
//             }
//             unsub();
//           });
//           if (!processed) {
//             throw new Error();
//           }
//           return; // It worked
//         } catch {
//           // none.
//         }
//     }
//     // Out of retries
//     throw new Error("Milestone was not processed.");
//   }

//   const mocker = (adr: string, params: any) => {
//     walletSpy.mockReturnValue(Promise.resolve({
//       address: adr,
//       body: params
//     }));
//   }

//   const createMemberFunc = async () => {
//     const dummyAddress: string = wallet.getRandomEthAddress();
//     mocker(dummyAddress, {});
//     const wCreate: any = testEnv.wrap(createMember);
//     const member: any = await wCreate(dummyAddress);
//     expect(member?.uid).toEqual(dummyAddress.toLowerCase());
//     return member;
//   }

//   const createSpaceFunc = async (adr: string, params: any) => {
//     mocker(adr, params);
//     const wrappedSpace: any = testEnv.wrap(createSpace);
//     const space: any = await wrappedSpace();
//     expect(space?.uid).toBeDefined();
//     return space;
//   }

//   const validateSpaceAddressFunc = async (adr: string, params: any) => {
//     mocker(adr, params);
//     const wrappedOrder: any = testEnv.wrap(validateAddress);
//     const order: any = await wrappedOrder();
//     expect(order?.type).toBe(TransactionType.ORDER);
//     expect(order?.payload.type).toBe(TransactionOrderType.SPACE_ADDRESS_VALIDATION);
//     return order;
//   }

//   const validateMemberAddressFunc = async (adr: string, params: any) => {
//     mocker(adr, params);
//     const wrappedOrder: any = testEnv.wrap(validateAddress);
//     const order: any = await wrappedOrder();
//     expect(order?.type).toBe(TransactionType.ORDER);
//     expect(order?.payload.type).toBe(TransactionOrderType.MEMBER_ADDRESS_VALIDATION);
//     return order;
//   }

//   const createCollectionFunc = async (adr: string, params: any) => {

//   }

//   const createNftFunc = async (adr: string, params: any) => {

//   }

//   const submitMilestoneFunc = async (adr: string, amount: number) => {
//       // Create milestone to process my validation.
//       const allMil = await db.collection(COL.MILESTONE).get();
//       const nextMilestone = (allMil.size + 1).toString();
//       await db.collection(COL.MILESTONE).doc(nextMilestone)
//       .collection('transactions').doc('9ae738e06688d9fbdfaf172e80c92e9da3174d541f9cc28503c826fcf679b251')
//       .set({
//         createdOn: serverTime(),
//         inputs: [{
//           address: '1qqsye008z79vj9p9ywzw65ed2xn4yxe9zfp9jqgw0gthxydxpa03qx32mhz',
//           amount: 123
//         }],
//         outputs: [{
//           address: adr,
//           amount: amount
//         }]
//       });
//       await db.collection(COL.MILESTONE).doc(nextMilestone).set({ completed: true });
//   }

//   const submitOrderFunc = async (params: any) => {

//   }



//   beforeEach(async () => {
//     dummyAddress = wallet.getRandomEthAddress();
//     walletSpy = jest.spyOn(wallet, 'decodeAuth');

//   });

//   it('One collection, one classic NFT, one purchase', async () => {
//     // To do.
//   });

//   it('One collection, one classic NFT, failed multiple purchase of same', async () => {
//     // To do.
//   });

//   it('One collection, one classic NFT, failed to pay (expires)', async () => {
//     // To do.
//   });

//   it('One collection, one classic NFT, failed to pay (expires) + someone else try to buy', async () => {
//     // To do.
//   });

//   it('One collection, one classic NFT, failed to pay (expires) + someone else purchases', async () => {
//     // To do.
//   });

//   it('One collection, one classic NFT, wrong amount', async () => {
//     // To do.
//   });

//   it('One collection, generated NFT, one purchase', async () => {
//     // To do.
//   });

//   it('One collection, generated NFT, one purchase trying multiple times', async () => {
//     // To do.
//   });

//   it('One collection, generated NFT (large), one purchase by multiple parties at once', async () => {
//     // To do.
//   });


// });
