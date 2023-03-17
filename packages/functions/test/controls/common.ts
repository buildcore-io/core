import {
  COL,
  Network,
  Space,
  SUB_COL,
  TokenStatus,
  TOKEN_SALE_TEST,
  TransactionOrder,
  TransactionOrderType,
  TransactionType,
} from '@soonaverse/interfaces';
import chance from 'chance';
import admin, { inc } from '../../src/admin.config';
import { createMember as createMemberFunc } from '../../src/controls/member.control';
import { createSpace as createSpaceFunc } from '../../src/runtime/firebase/space/index';
import * as config from '../../src/utils/config.utils';
import { cOn, serverTime } from '../../src/utils/dateTime.utils';
import * as ipUtils from '../../src/utils/ip.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { getWallet, MEDIA, testEnv } from '../set-up';
import { validateAddress } from './../../src/controls/address.control';

export const mockWalletReturnValue = <T>(walletSpy: any, address: string, body: T) =>
  walletSpy.mockReturnValue(Promise.resolve({ address, body }));

export const expectThrow = async <C, E>(call: C | Promise<C>, error: E) => {
  try {
    await call;
    fail();
  } catch (e: any) {
    expect(e.details.key).toBe(error);
  }
};

export const milestoneProcessed = async (
  nextMilestone: string,
  defTranId: string,
  network?: Network,
) => {
  for (let attempt = 0; attempt < 400; ++attempt) {
    await new Promise((r) => setTimeout(r, 500));
    const doc = await admin
      .firestore()
      .doc(
        `${COL.MILESTONE + (network ? `_${network}` : '')}/${nextMilestone}/${
          SUB_COL.TRANSACTIONS
        }/${defTranId}`,
      )
      .get();
    if (doc.data()?.processed) {
      return;
    }
  }
  throw new Error('Milestone was not processed. Id: ' + nextMilestone);
};

export const submitMilestoneFunc = async (address: string, amount: number, network?: Network) =>
  submitMilestoneOutputsFunc([{ address, amount }], network);

export const submitMilestoneOutputsFunc = async <T>(outputs: T[], network?: Network) => {
  const milestoneColl = admin
    .firestore()
    .collection(COL.MILESTONE + (network ? `_${network}` : ''));
  const nextMilestone = wallet.getRandomEthAddress();
  const defTranId = chance().string({
    pool: 'abcdefghijklmnopqrstuvwxyz',
    casing: 'lower',
    length: 40,
  });
  const defaultFromAddress =
    'iota' + chance().string({ pool: 'abcdefghijklmnopqrstuvwxyz', casing: 'lower', length: 40 });
  const doc = milestoneColl.doc(nextMilestone).collection(SUB_COL.TRANSACTIONS).doc(defTranId);
  await doc.set({
    createdOn: serverTime(),
    messageId: 'mes-' + defTranId,
    inputs: [{ address: defaultFromAddress, amount: 123 }],
    outputs: outputs,
  });
  await doc.update({ complete: true });
  return { milestone: nextMilestone, tranId: defTranId, fromAdd: defaultFromAddress };
};

export const validateSpaceAddressFunc = async (
  spy: any,
  adr: string,
  space: string,
  network?: Network,
) => {
  mockWalletReturnValue(spy, adr, network ? { space, network } : { space });
  const order = await testEnv.wrap(validateAddress)({});
  expect(order?.type).toBe(TransactionType.ORDER);
  expect(order?.payload.type).toBe(TransactionOrderType.SPACE_ADDRESS_VALIDATION);
  return <TransactionOrder>order;
};

export const validateMemberAddressFunc = async (spy: any, adr: string, network?: Network) => {
  mockWalletReturnValue(spy, adr, network ? { network } : {});
  const order = await testEnv.wrap(validateAddress)({});
  expect(order?.type).toBe(TransactionType.ORDER);
  expect(order?.payload.type).toBe(TransactionOrderType.MEMBER_ADDRESS_VALIDATION);
  return <TransactionOrder>order;
};

export const createMember = async (spy: any): Promise<string> => {
  const memberAddress = wallet.getRandomEthAddress();
  mockWalletReturnValue(spy, memberAddress, {});
  await testEnv.wrap(createMemberFunc)(memberAddress);
  for (const network of Object.values(Network)) {
    const wallet = await getWallet(network);
    const address = await wallet.getNewIotaAddressDetails();
    await admin
      .firestore()
      .doc(`${COL.MEMBER}/${memberAddress}`)
      .update({ [`validatedAddress.${network}`]: address.bech32, name: getRandomSymbol() });
  }
  return memberAddress;
};

export const createSpace = async (spy: any, guardian: string): Promise<Space> => {
  mockWalletReturnValue(spy, guardian, { name: 'Space A', bannerUrl: MEDIA });
  const space = await testEnv.wrap(createSpaceFunc)({});
  const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${space.uid}`);
  for (const network of Object.values(Network)) {
    const wallet = await getWallet(network);
    const address = await wallet.getNewIotaAddressDetails();
    await spaceDocRef.update({ [`validatedAddress.${network}`]: address.bech32 });
  }
  return <Space>(await spaceDocRef.get()).data();
};

export const tokenProcessed = (tokenId: string, distributionLength: number, reconciled: boolean) =>
  wait(async () => {
    const doc = await admin.firestore().doc(`${COL.TOKEN}/${tokenId}`).get();
    const distributionsSnap = await admin
      .firestore()
      .collection(`${COL.TOKEN}/${tokenId}/${SUB_COL.DISTRIBUTION}`)
      .get();
    const distributionsOk = distributionsSnap.docs.reduce(
      (acc, doc) => acc && (doc.data()?.reconciled || false) === reconciled,
      distributionLength === distributionsSnap.docs.length,
    );
    if (doc.data()?.status === TokenStatus.ERROR) {
      throw new Error('Token not processed: ' + tokenId);
    }
    return distributionsOk && doc.data()?.status === TokenStatus.PRE_MINTED;
  });

export const wait = async (func: () => Promise<boolean>, maxAttempt = 1200, delay = 500) => {
  for (let attempt = 0; attempt < maxAttempt; ++attempt) {
    if (await func()) {
      return;
    }
    await new Promise((r) => setTimeout(r, delay));
  }
  throw new Error('Timeout');
};

const isProdSpy = jest.spyOn(config, 'isProdEnv');
const blockedCountriesSpy = jest.spyOn(ipUtils, 'getBlockedCountries');
const ipInfoMock = jest.spyOn(ipUtils, 'getIpInfo');

export const mockIpCheck = (
  isProdEnv: boolean,
  blockedCountries: { [key: string]: string[] },
  ipInfo: any,
) => {
  isProdSpy.mockReturnValueOnce(isProdEnv);
  blockedCountriesSpy.mockReturnValueOnce(blockedCountries);
  ipInfoMock.mockReturnValueOnce(ipInfo);
};

const alphabet = 'abcdefghijklmnopqrstuvwxyz';
export const getRandomSymbol = () =>
  Array.from(Array(4))
    .map(() => alphabet[Math.floor(Math.random() * alphabet.length)])
    .join('')
    .toUpperCase();

export const createRoyaltySpaces = async () => {
  const spaceOneId = TOKEN_SALE_TEST.spaceone;
  const spaceTwoId = TOKEN_SALE_TEST.spacetwo;
  const walletSpy = jest.spyOn(wallet, 'decodeAuth');
  const guardian = await createMember(walletSpy);

  const spaceIdSpy = jest.spyOn(wallet, 'getRandomEthAddress');
  const spaceOneDoc = await admin.firestore().doc(`${COL.SPACE}/${spaceOneId}`).get();
  if (!spaceOneDoc.exists) {
    spaceIdSpy.mockReturnValue(spaceOneId);
    await createSpace(walletSpy, guardian);
  }

  const spaceTwoDoc = await admin.firestore().doc(`${COL.SPACE}/${spaceTwoId}`).get();
  if (!spaceTwoDoc.exists) {
    spaceIdSpy.mockReturnValue(spaceTwoId);
    await createSpace(walletSpy, guardian);
  }

  spaceIdSpy.mockRestore();
  walletSpy.mockRestore();
};

export const addGuardianToSpace = async (space: string, member: string) => {
  const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${space}`);
  const guardianDocRef = spaceDocRef.collection(SUB_COL.GUARDIANS).doc(member);
  const guardian = await guardianDocRef.get();
  if (guardian.exists) {
    return;
  }
  await guardianDocRef.set(
    cOn({
      uid: member,
      parentId: space,
      parentCol: COL.SPACE,
    }),
  );
  await spaceDocRef.update({ totalGuardians: inc(1), totalMembers: inc(1) });
};

export const removeGuardianFromSpace = async (space: string, member: string) => {
  const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${space}`);
  const guardianDocRef = spaceDocRef.collection(SUB_COL.GUARDIANS).doc(member);
  await guardianDocRef.delete();
  await spaceDocRef.update({ totalGuardians: inc(-1), totalMembers: inc(-11) });
};

export const saveSoon = async () => {
  const soonTokenId = '0xa381bfccaf121e38e31362d85b5ad30cd7fc0d06';
  await admin
    .firestore()
    .doc(`${COL.TOKEN}/${soonTokenId}`)
    .set({ uid: soonTokenId, symbol: 'SOON' });
  return soonTokenId;
};
