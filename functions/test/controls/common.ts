import chance from 'chance';
import { Space, TransactionOrder, TransactionOrderType, TransactionType } from '../../interfaces/models';
import { COL, SUB_COL } from '../../interfaces/models/base';
import { TokenStatus } from '../../interfaces/models/token';
import admin from '../../src/admin.config';
import { createMember as createMemberFunc } from "../../src/controls/member.control";
import { createSpace as createSpaceFunc } from "../../src/controls/space.control";
import { serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import { validateAddress } from './../../src/controls/order.control';
import * as ipUtils from '../../src/utils/ip.utils';
import * as config from '../../src/utils/config.utils';
import { TOKEN_SALE_TEST } from '../../interfaces/config';

export const mockWalletReturnValue = <T,>(walletSpy: any, address: string, body: T) =>
  walletSpy.mockReturnValue(Promise.resolve({ address, body }));

export const expectThrow = async <C, E>(call: Promise<C>, error: E) => {
  try {
    await call;
    fail()
  } catch (e) {
    expect(e.details.key).toBe(error)
  }
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

export const submitMilestoneFunc = async (address: string, amount: number) => submitMilestoneOutputsFunc([{ address, amount }]);

export const submitMilestoneOutputsFunc = async <T>(outputs: T[]) => {
  const allMil = await admin.firestore().collection(COL.MILESTONE).get();
  const nextMilestone = (allMil.size + 1).toString();
  const defTranId = chance().string({ pool: 'abcdefghijklmnopqrstuvwxyz', casing: 'lower', length: 40 });
  const defaultFromAddress = 'iota' + chance().string({ pool: 'abcdefghijklmnopqrstuvwxyz', casing: 'lower', length: 40 });
  const doc = admin.firestore().collection(COL.MILESTONE).doc(nextMilestone).collection('transactions').doc(defTranId)
  await doc.set({
    createdOn: serverTime(),
    messageId: 'mes-' + defTranId,
    inputs: [{ address: defaultFromAddress, amount: 123 }],
    outputs: outputs
  });
  await doc.update({ complete: true });
  return { milestone: nextMilestone, tranId: defTranId, fromAdd: defaultFromAddress };
}

export const validateSpaceAddressFunc = async (spy: any, adr: string, space: string) => {
  mockWalletReturnValue(spy, adr, { space });
  const order = await testEnv.wrap(validateAddress)({});
  expect(order?.type).toBe(TransactionType.ORDER);
  expect(order?.payload.type).toBe(TransactionOrderType.SPACE_ADDRESS_VALIDATION);
  return <TransactionOrder>order;
}

export const validateMemberAddressFunc = async (spy: any, adr: string) => {
  mockWalletReturnValue(spy, adr, {});
  const order = await testEnv.wrap(validateAddress)({});
  expect(order?.type).toBe(TransactionType.ORDER);
  expect(order?.payload.type).toBe(TransactionOrderType.MEMBER_ADDRESS_VALIDATION);
  return <TransactionOrder>order;
}


export const createMember = async (spy: any, validate?: boolean): Promise<string> => {
  const memberAddress = wallet.getRandomEthAddress();
  mockWalletReturnValue(spy, memberAddress, {})
  await testEnv.wrap(createMemberFunc)(memberAddress);
  if (validate) {
    const memberValidation = await validateMemberAddressFunc(spy, memberAddress);
    const milestone = await submitMilestoneFunc(memberValidation.payload.targetAddress, memberValidation.payload.amount);
    await milestoneProcessed(milestone.milestone, milestone.tranId);
  }
  return memberAddress;
}

export const createSpace = async (spy: any, guardian: string, validate?: boolean): Promise<Space> => {
  mockWalletReturnValue(spy, guardian, { name: 'Space A' })
  const space = await testEnv.wrap(createSpaceFunc)({});
  if (validate) {
    const spaceValidation = await validateSpaceAddressFunc(spy, guardian, space.uid);
    const nextMilestone = await submitMilestoneFunc(spaceValidation.payload.targetAddress, spaceValidation.payload.amount);
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);
  }
  return <Space>(await admin.firestore().doc(`${COL.SPACE}/${space.uid}`).get()).data()
}

export const tokenProcessed = (tokenId: string, distributionLength: number, reconciled: boolean) =>
  wait(async () => {
    const doc = await admin.firestore().doc(`${COL.TOKEN}/${tokenId}`).get();
    const distributionsSnap = await admin.firestore().collection(`${COL.TOKEN}/${tokenId}/${SUB_COL.DISTRIBUTION}`).get()
    const distributionsOk = distributionsSnap.docs.reduce((acc, doc) => acc && ((doc.data()?.reconciled || false) === reconciled), distributionLength === distributionsSnap.docs.length)
    if (doc.data()?.status === TokenStatus.ERROR) {
      throw new Error("Token not processed: " + tokenId);
    }
    return distributionsOk && doc.data()?.status === TokenStatus.PRE_MINTED
  })


export const wait = async (func: () => Promise<boolean>, maxAttempt = 60) => {
  for (let attempt = 0; attempt < maxAttempt; ++attempt) {
    if (await func()) {
      return
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Timeout");
}

const isProdSpy = jest.spyOn(config, 'isProdEnv')
const blockedCountriesSpy = jest.spyOn(ipUtils, 'getBlockedCountries')
const ipInfoMock = jest.spyOn(ipUtils, 'getIpInfo')

export const mockIpCheck = (isProdEnv: boolean, blockedCountries: { [key: string]: string[] }, ipInfo: any) => {
  isProdSpy.mockReturnValueOnce(isProdEnv)
  blockedCountriesSpy.mockReturnValueOnce(blockedCountries)
  ipInfoMock.mockReturnValueOnce(ipInfo)
}

export const createRoyaltySpaces = async () => {
  const spaceOneId = TOKEN_SALE_TEST.spaceone
  const spaceTwoId = TOKEN_SALE_TEST.spacetwo
  const walletSpy = jest.spyOn(wallet, 'getRandomEthAddress');
  const guardian = await createMember(walletSpy, true);

  const spaceIdSpy = jest.spyOn(wallet, 'getRandomEthAddress');
  const spaceOneDoc = await admin.firestore().doc(`${COL.SPACE}/${spaceOneId}`).get()
  if (!spaceOneDoc.exists) {
    spaceIdSpy.mockReturnValue(spaceOneId)
    await createSpace(walletSpy, guardian, true);
  }

  const spaceTwoDoc = await admin.firestore().doc(`${COL.SPACE}/${spaceTwoId}`).get()
  if (!spaceTwoDoc.exists) {
    spaceIdSpy.mockReturnValue(spaceTwoId)
    await createSpace(walletSpy, guardian, true);
  }

  spaceIdSpy.mockRestore();
  walletSpy.mockRestore();
}
