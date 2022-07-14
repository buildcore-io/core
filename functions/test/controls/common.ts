import chance from 'chance';
import { DEFAULT_NETWORK, TOKEN_SALE_TEST } from '../../interfaces/config';
import { Network, Space, TransactionOrder, TransactionOrderType, TransactionType } from '../../interfaces/models';
import { COL, SUB_COL } from '../../interfaces/models/base';
import { TokenStatus } from '../../interfaces/models/token';
import admin from '../../src/admin.config';
import { createMember as createMemberFunc } from "../../src/controls/member.control";
import { createSpace as createSpaceFunc } from "../../src/controls/space.control";
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { WalletService } from '../../src/services/wallet/wallet';
import * as config from '../../src/utils/config.utils';
import { serverTime } from '../../src/utils/dateTime.utils';
import * as ipUtils from '../../src/utils/ip.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import { validateAddress } from './../../src/controls/order.control';

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

export const milestoneProcessed = async (nextMilestone: string, defTranId: string, network?: Network) => {
  for (let attempt = 0; attempt < 400; ++attempt) {
    await new Promise((r) => setTimeout(r, 500));
    const doc = await admin.firestore().doc(`${COL.MILESTONE + (network ? `_${network}` : '')}/${nextMilestone}/${SUB_COL.TRANSACTIONS}/${defTranId}`).get();
    if (doc.data()?.processed) {
      return
    }
  }
  throw new Error("Milestone was not processed. Id: " + nextMilestone);
}

export const submitMilestoneFunc = async (address: string, amount: number, network?: Network) => submitMilestoneOutputsFunc([{ address, amount }], network);

export const submitMilestoneOutputsFunc = async <T>(outputs: T[], network?: Network) => {
  const milestoneColl = admin.firestore().collection(COL.MILESTONE + (network ? `_${network}` : ''))
  const allMil = await milestoneColl.get();
  const nextMilestone = (allMil.size + 1).toString();
  const defTranId = chance().string({ pool: 'abcdefghijklmnopqrstuvwxyz', casing: 'lower', length: 40 });
  const defaultFromAddress = 'iota' + chance().string({ pool: 'abcdefghijklmnopqrstuvwxyz', casing: 'lower', length: 40 });
  const doc = milestoneColl.doc(nextMilestone).collection(SUB_COL.TRANSACTIONS).doc(defTranId)
  await doc.set({
    createdOn: serverTime(),
    messageId: 'mes-' + defTranId,
    inputs: [{ address: defaultFromAddress, amount: 123 }],
    outputs: outputs
  });
  await doc.update({ complete: true });
  return { milestone: nextMilestone, tranId: defTranId, fromAdd: defaultFromAddress };
}

export const validateSpaceAddressFunc = async (spy: any, adr: string, space: string, targetNetwork?: Network) => {
  mockWalletReturnValue(spy, adr, targetNetwork ? { space, targetNetwork } : { space });
  const order = await testEnv.wrap(validateAddress)({});
  expect(order?.type).toBe(TransactionType.ORDER);
  expect(order?.payload.type).toBe(TransactionOrderType.SPACE_ADDRESS_VALIDATION);
  return <TransactionOrder>order;
}

export const validateMemberAddressFunc = async (spy: any, adr: string, targetNetwork?: Network) => {
  mockWalletReturnValue(spy, adr, targetNetwork ? { targetNetwork } : {});
  const order = await testEnv.wrap(validateAddress)({});
  expect(order?.type).toBe(TransactionType.ORDER);
  expect(order?.payload.type).toBe(TransactionOrderType.MEMBER_ADDRESS_VALIDATION);
  return <TransactionOrder>order;
}


export const createMember = async (spy: any, network = DEFAULT_NETWORK): Promise<string> => {
  const memberAddress = wallet.getRandomEthAddress();
  mockWalletReturnValue(spy, memberAddress, {})
  await testEnv.wrap(createMemberFunc)(memberAddress);
  const walletService = WalletService.newWallet(network)
  const address = await walletService.getNewIotaAddressDetails()
  await MnemonicService.store(address.bech32, address.mnemonic, network)
  await admin.firestore().doc(`${COL.MEMBER}/${memberAddress}`).update({ [`validatedAddress.${network}`]: address.bech32 })
  return memberAddress;
}

export const createSpace = async (spy: any, guardian: string, network = DEFAULT_NETWORK): Promise<Space> => {
  mockWalletReturnValue(spy, guardian, { name: 'Space A' })
  const space = await testEnv.wrap(createSpaceFunc)({});
  const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${space.uid}`)
  const wallet = WalletService.newWallet(network)
  const address = await wallet.getNewIotaAddressDetails()
  await MnemonicService.store(address.bech32, address.mnemonic, network)
  await spaceDocRef.update({ [`validatedAddress.${network}`]: address.bech32 })
  return <Space>(await spaceDocRef.get()).data()
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

const alphabet = "abcdefghijklmnopqrstuvwxyz"
export const getRandomSymbol = () => Array.from(Array(4)).map(() => alphabet[Math.floor(Math.random() * alphabet.length)]).join('').toUpperCase()

export const createRoyaltySpaces = async (network: Network) => {
  const spaceOneId = TOKEN_SALE_TEST.spaceone
  const spaceTwoId = TOKEN_SALE_TEST.spacetwo
  const walletSpy = jest.spyOn(wallet, 'decodeAuth');
  const guardian = await createMember(walletSpy);

  const spaceIdSpy = jest.spyOn(wallet, 'getRandomEthAddress');
  const spaceOneDoc = await admin.firestore().doc(`${COL.SPACE}/${spaceOneId}`).get()
  if (!spaceOneDoc.exists) {
    spaceIdSpy.mockReturnValue(spaceOneId)
    await createSpace(walletSpy, guardian, network);
  }

  const spaceTwoDoc = await admin.firestore().doc(`${COL.SPACE}/${spaceTwoId}`).get()
  if (!spaceTwoDoc.exists) {
    spaceIdSpy.mockReturnValue(spaceTwoId)
    await createSpace(walletSpy, guardian, network);
  }

  spaceIdSpy.mockRestore();
  walletSpy.mockRestore();
}
