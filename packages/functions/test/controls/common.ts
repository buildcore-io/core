import { database } from '@buildcore/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  SOON_PROJECT_ID,
  SUB_COL,
  TOKEN_SALE_TEST,
  TokenStatus,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  WEN_FUNC,
  getMilestoneCol,
} from '@buildcore/interfaces';
import { TransactionPayload, UTXOInput, Utils } from '@iota/sdk';
import dayjs from 'dayjs';
import { createSpaceControl } from '../../src/controls/space/space.create.control';
import { packBasicOutput } from '../../src/utils/basic-output.utils';
import { createUnlock, packEssence } from '../../src/utils/block.utils';
import * as config from '../../src/utils/config.utils';
import * as ipUtils from '../../src/utils/ip.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { MEDIA, getWallet, mockWalletReturnValue, testEnv } from '../set-up';

export const validateMemberAddressFunc = async (member: string, network = Network.RMS) => {
  mockWalletReturnValue(member, { network });
  const order = await testEnv.wrap<Transaction>(WEN_FUNC.validateAddress);
  expect(order?.type).toBe(TransactionType.ORDER);
  expect(order?.payload.type).toBe(TransactionPayloadType.MEMBER_ADDRESS_VALIDATION);
  return order;
};

export const submitMilestoneFunc = async (order: Transaction, customAmount?: number) => {
  const amount = customAmount || order.payload.amount || 0;
  const network = order.network || Network.IOTA;
  const to = order.payload.targetAddress!;
  const walletService = await getWallet(network);
  const from = await walletService.getNewIotaAddressDetails();
  const consumedOutputId = '0xbdb062b39e38c3ea0b37c32d564ee839da4e1d66ceb035a56ed1e87caa3fc5950000';
  const consumedOutputs = await packBasicOutput(walletService, from.bech32, amount, {});
  const inputs = [UTXOInput.fromOutputId(consumedOutputId)];
  const inputsCommitment = Utils.computeInputsCommitment([consumedOutputs]);
  const outputs = [await packBasicOutput(walletService, to, amount, {})];
  const essence = await packEssence(walletService, inputs, inputsCommitment, outputs, {});
  const unlocks = [await createUnlock(essence, from)];
  const payload = new TransactionPayload(essence, unlocks);
  const milestoneCol = getMilestoneCol(network);
  const nextMilestone = Math.floor(Math.random() * MIN_IOTA_AMOUNT).toString();
  const defTranId = getRandomEthAddress();
  const tranDocRef = database().doc(milestoneCol, nextMilestone, SUB_COL.TRANSACTIONS, defTranId);
  await tranDocRef.upsert({
    createdOn: dayjs().toDate(),
    blockId: getRandomEthAddress(),
    milestone: Number(nextMilestone),
    payload: JSON.stringify(payload),
  });
  await milestoneProcessed(nextMilestone, defTranId, network);
  return { milestone: nextMilestone, tranId: defTranId, fromAdd: from.bech32 };
};

export const milestoneProcessed = async (
  nextMilestone: string,
  defTranId: string,
  network: Network,
) => {
  for (let attempt = 0; attempt < 400; ++attempt) {
    await new Promise((r) => setTimeout(r, 500));
    const milestoneTranDocRef = database().doc(
      getMilestoneCol(network),
      nextMilestone,
      SUB_COL.TRANSACTIONS,
      defTranId,
    );
    const doc = await milestoneTranDocRef.get();
    if (doc?.processed) {
      return;
    }
  }
  throw new Error('Milestone was not processed. Id: ' + nextMilestone);
};

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

export const setProdTiers = async () => {
  const soonProjDocRef = database().doc(COL.PROJECT, SOON_PROJECT_ID);
  const soonProject = {
    config_tiers: [0, 10, 4000, 6000, 15000].map((v) => v * MIN_IOTA_AMOUNT),
    config_tokenTradingFeeDiscountPercentage: [0, 25, 50, 75, 100],
  };
  await soonProjDocRef.upsert(soonProject);
};

export const setTestTiers = async () => {
  const soonProjDocRef = database().doc(COL.PROJECT, SOON_PROJECT_ID);
  const soonProject = {
    config_tiers: [0, 0, 0, 0, 0].map((v) => v * MIN_IOTA_AMOUNT),
    config_tokenTradingFeeDiscountPercentage: [0, 0, 0, 0, 0],
  };
  await soonProjDocRef.upsert(soonProject);
};
const alphabet = 'abcdefghijklmnopqrstuvwxyz';

export const getRandomSymbol = () =>
  Array.from(Array(4))
    .map(() => alphabet[Math.floor(Math.random() * alphabet.length)])
    .join('')
    .toUpperCase();

export const expectThrow = async <C>(call: Promise<C>, error: string, message = '') => {
  try {
    await call;
    fail();
  } catch (e: any) {
    expect(e.key || e.eKey).toBe(error);
    if (message) {
      expect(e.message || e.eMessage).toBe(message);
    }
  }
};

export const addGuardianToSpace = async (space: string, member: string) => {
  const guardianDocRef = database().doc(COL.SPACE, space, SUB_COL.GUARDIANS, member);
  const guardian = await guardianDocRef.get();
  if (guardian) {
    return;
  }
  await guardianDocRef.upsert({ parentId: space });
  await database()
    .doc(COL.SPACE, space)
    .update({ totalGuardians: database().inc(1), totalMembers: database().inc(1) });
};

export const createRoyaltySpaces = async () => {
  const guardian = await testEnv.createMember();
  const spaceOneId = TOKEN_SALE_TEST.spaceone;
  const spaceTwoId = TOKEN_SALE_TEST.spacetwo;
  const spaceIdSpy = jest.spyOn(wallet, 'getRandomEthAddress');
  const spaceOneDoc = database().doc(COL.SPACE, spaceOneId);
  if (!(await spaceOneDoc.get())) {
    spaceIdSpy.mockReturnValue(spaceOneId);
    mockWalletReturnValue(guardian, { name: 'Space A', bannerUrl: MEDIA });
    await testEnv.mockWrap(createSpaceControl);
    const addresses = {} as any;
    const promises = Object.values(Network).map(async (network) => {
      const wallet = await getWallet(network);
      const address = await wallet.getNewIotaAddressDetails();
      addresses[`${network}Address`] = address.bech32;
    });
    await Promise.all(promises);
    await spaceOneDoc.update(addresses);
  }
  const spaceTwoDoc = database().doc(COL.SPACE, spaceTwoId);
  if (!(await spaceTwoDoc.get())) {
    spaceIdSpy.mockReturnValue(spaceTwoId);
    mockWalletReturnValue(guardian, { name: 'Space A', bannerUrl: MEDIA });
    await testEnv.mockWrap(createSpaceControl);
    const addresses = {} as any;
    const promises = Object.values(Network).map(async (network) => {
      const wallet = await getWallet(network);
      const address = await wallet.getNewIotaAddressDetails();
      addresses[`${network}Address`] = address.bech32;
    });
    await Promise.all(promises);
    await spaceTwoDoc.update(addresses);
  }
  spaceIdSpy.mockRestore();
};

export const removeGuardianFromSpace = async (space: string, member: string) => {
  const spaceDocRef = database().doc(COL.SPACE, space);
  const guardianDocRef = database().doc(COL.SPACE, space, SUB_COL.GUARDIANS, member);
  await guardianDocRef.delete();
  await spaceDocRef.update({
    totalGuardians: database().inc(-1),
    totalMembers: database().inc(-1),
  });
};

export const tokenProcessed = (tokenId: string, distributionLength: number, reconciled: boolean) =>
  wait(async () => {
    const doc = await database().doc(COL.TOKEN, tokenId).get();
    const distributionsSnap = await database()
      .collection(COL.TOKEN, tokenId, SUB_COL.DISTRIBUTION)
      .get();
    const distributionsOk = distributionsSnap.reduce(
      (acc, doc) => acc && (doc?.reconciled || false) === reconciled,
      distributionLength === distributionsSnap.length,
    );
    if (doc?.status === TokenStatus.ERROR) {
      throw new Error('Token not processed: ' + tokenId);
    }
    return distributionsOk && doc?.status === TokenStatus.PRE_MINTED;
  });
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
