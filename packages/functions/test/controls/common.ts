import {
  COL,
  Network,
  SUB_COL,
  Space,
  TOKEN_SALE_TEST,
  Token,
  TokenDistribution,
  TokenStatus,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  getMilestoneCol,
} from '@build-5/interfaces';
import { TransactionHelper } from '@iota/iota.js-next';
import dayjs from 'dayjs';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { validateAddress } from '../../src/runtime/firebase/address';
import { createMember as createMemberFunc } from '../../src/runtime/firebase/member';
import { createSpace as createSpaceFunc } from '../../src/runtime/firebase/space/index';
import { packBasicOutput } from '../../src/utils/basic-output.utils';
import { packEssence, packPayload } from '../../src/utils/block.utils';
import * as config from '../../src/utils/config.utils';
import * as ipUtils from '../../src/utils/ip.utils';
import { createUnlock } from '../../src/utils/smr.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { MEDIA, getWallet, testEnv } from '../set-up';

export const mockWalletReturnValue = <T>(walletSpy: any, address: string, body: T) =>
  walletSpy.mockReturnValue(Promise.resolve({ address, body }));

export const expectThrow = async <C, E>(call: C | Promise<C>, error: E, message?: string) => {
  try {
    await call;
    fail();
  } catch (e: any) {
    expect(e.key).toBe(error);
    if (message) {
      expect(e.message).toBe(message);
    }
  }
};

export const milestoneProcessed = async (
  nextMilestone: string,
  defTranId: string,
  network: Network,
) => {
  for (let attempt = 0; attempt < 400; ++attempt) {
    await new Promise((r) => setTimeout(r, 500));
    const milestoneTranDocRef = build5Db()
      .collection(getMilestoneCol(network))
      .doc(nextMilestone)
      .collection(SUB_COL.TRANSACTIONS)
      .doc(defTranId);
    const doc = await milestoneTranDocRef.get<Record<string, unknown>>();
    if (doc?.processed) {
      return;
    }
  }
  throw new Error('Milestone was not processed. Id: ' + nextMilestone);
};

export const submitMilestoneFunc = async (order: Transaction, customAmount?: number) => {
  const amount = customAmount || order.payload.amount || 0;
  const network = order.network || Network.IOTA;
  const to = order.payload.targetAddress!;
  const walletService = await getWallet(network);

  const from = await walletService.getNewIotaAddressDetails();

  const consumedOutputId = '0xbdb062b39e38c3ea0b37c32d564ee839da4e1d66ceb035a56ed1e87caa3fc5950000';
  const consumedOutputs = packBasicOutput(from.bech32, amount, [], walletService.info);
  const inputs = [TransactionHelper.inputFromOutputId(consumedOutputId)];
  const inputsCommitment = TransactionHelper.getInputsCommitment([consumedOutputs]);
  const outputs = [packBasicOutput(to, amount, [], walletService.info)];
  const essence = packEssence(inputs, inputsCommitment, outputs, walletService, {});
  const unlocks = [createUnlock(essence, from.keyPair)];
  const payload = packPayload(essence, unlocks);

  const milestoneColl = getMilestoneCol(network);
  const nextMilestone = wallet.getRandomEthAddress();
  const defTranId = wallet.getRandomEthAddress();
  const tranDocRef = build5Db()
    .doc(`${milestoneColl}/${nextMilestone}`)
    .collection(SUB_COL.TRANSACTIONS)
    .doc(defTranId);
  await tranDocRef.set({
    uid: defTranId,
    createdOn: dayjs().toDate(),
    blockId: wallet.getRandomEthAddress(),
    milestone: wallet.getRandomEthAddress(),
    payload,
  });
  await tranDocRef.update({ complete: true });

  await milestoneProcessed(nextMilestone, defTranId, network);

  return { milestone: nextMilestone, tranId: defTranId, fromAdd: from.bech32 };
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
  expect(order?.payload.type).toBe(TransactionPayloadType.SPACE_ADDRESS_VALIDATION);
  return <Transaction>order;
};

export const validateMemberAddressFunc = async (spy: any, adr: string, network?: Network) => {
  mockWalletReturnValue(spy, adr, network ? { network } : {});
  const order = await testEnv.wrap(validateAddress)({});
  expect(order?.type).toBe(TransactionType.ORDER);
  expect(order?.payload.type).toBe(TransactionPayloadType.MEMBER_ADDRESS_VALIDATION);
  return <Transaction>order;
};

export const createMember = async (spy: any): Promise<string> => {
  const memberAddress = wallet.getRandomEthAddress();
  mockWalletReturnValue(spy, memberAddress, {});
  await testEnv.wrap(createMemberFunc)(memberAddress);
  for (const network of Object.values(Network)) {
    const wallet = await getWallet(network);
    const address = await wallet.getNewIotaAddressDetails();
    await build5Db()
      .doc(`${COL.MEMBER}/${memberAddress}`)
      .update({ [`validatedAddress.${network}`]: address.bech32, name: getRandomSymbol() });
  }
  return memberAddress;
};

export const createSpace = async (spy: any, guardian: string): Promise<Space> => {
  mockWalletReturnValue(spy, guardian, { name: 'Space A', bannerUrl: MEDIA });
  const space = await testEnv.wrap(createSpaceFunc)({});
  const spaceDocRef = build5Db().doc(`${COL.SPACE}/${space.uid}`);
  for (const network of Object.values(Network)) {
    const wallet = await getWallet(network);
    const address = await wallet.getNewIotaAddressDetails();
    await spaceDocRef.update({ [`validatedAddress.${network}`]: address.bech32 });
  }
  return <Space>await spaceDocRef.get();
};

export const tokenProcessed = (tokenId: string, distributionLength: number, reconciled: boolean) =>
  wait(async () => {
    const doc = await build5Db().doc(`${COL.TOKEN}/${tokenId}`).get<Token>();
    const distributionsSnap = await build5Db()
      .doc(`${COL.TOKEN}/${tokenId}`)
      .collection(SUB_COL.DISTRIBUTION)
      .get<TokenDistribution>();
    const distributionsOk = distributionsSnap.reduce(
      (acc, doc) => acc && (doc?.reconciled || false) === reconciled,
      distributionLength === distributionsSnap.length,
    );
    if (doc?.status === TokenStatus.ERROR) {
      throw new Error('Token not processed: ' + tokenId);
    }
    return distributionsOk && doc?.status === TokenStatus.PRE_MINTED;
  });

export const wait = async (
  func: () => Promise<boolean | undefined>,
  maxAttempt = 1200,
  delay = 500,
) => {
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
  const spaceOneDoc = await build5Db().doc(`${COL.SPACE}/${spaceOneId}`).get();
  if (!spaceOneDoc) {
    spaceIdSpy.mockReturnValue(spaceOneId);
    await createSpace(walletSpy, guardian);
  }

  const spaceTwoDoc = await build5Db().doc(`${COL.SPACE}/${spaceTwoId}`).get();
  if (!spaceTwoDoc) {
    spaceIdSpy.mockReturnValue(spaceTwoId);
    await createSpace(walletSpy, guardian);
  }

  spaceIdSpy.mockRestore();
  walletSpy.mockRestore();
};

export const addGuardianToSpace = async (space: string, member: string) => {
  const spaceDocRef = build5Db().doc(`${COL.SPACE}/${space}`);
  const guardianDocRef = spaceDocRef.collection(SUB_COL.GUARDIANS).doc(member);
  const guardian = await guardianDocRef.get();
  if (guardian) {
    return;
  }
  await guardianDocRef.set({
    uid: member,
    parentId: space,
    parentCol: COL.SPACE,
  });
  await spaceDocRef.update({ totalGuardians: build5Db().inc(1), totalMembers: build5Db().inc(1) });
};

export const removeGuardianFromSpace = async (space: string, member: string) => {
  const spaceDocRef = build5Db().doc(`${COL.SPACE}/${space}`);
  const guardianDocRef = spaceDocRef.collection(SUB_COL.GUARDIANS).doc(member);
  await guardianDocRef.delete();
  await spaceDocRef.update({
    totalGuardians: build5Db().inc(-1),
    totalMembers: build5Db().inc(-11),
  });
};

export const saveSoon = async () => {
  const soonTokenId = '0xa381bfccaf121e38e31362d85b5ad30cd7fc0d06';
  await build5Db().doc(`${COL.TOKEN}/${soonTokenId}`).set({ uid: soonTokenId, symbol: 'SOON' });
  return soonTokenId;
};
