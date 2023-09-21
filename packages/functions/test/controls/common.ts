import { build5Db } from '@build-5/database';
import {
  COL,
  DecodedToken,
  MIN_IOTA_AMOUNT,
  Network,
  NetworkAddress,
  SOON_PROJECT_ID,
  SUB_COL,
  Space,
  TOKEN_SALE_TEST,
  Token,
  TokenDistribution,
  TokenStatus,
  Transaction,
  TransactionPayloadType,
  TransactionType,
} from '@build-5/interfaces';
import chance from 'chance';
import { validateAddress } from '../../src/runtime/firebase/address';
import { createMember as createMemberFunc } from '../../src/runtime/firebase/member';
import { createSpace as createSpaceFunc } from '../../src/runtime/firebase/space/index';
import * as config from '../../src/utils/config.utils';
import { serverTime } from '../../src/utils/dateTime.utils';
import * as ipUtils from '../../src/utils/ip.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { MEDIA, getWallet, testEnv } from '../set-up';

export const mockWalletReturnValue = <T>(
  walletSpy: any,
  address: NetworkAddress,
  body: T,
  noProject = false,
) => {
  const decodedToken: DecodedToken = { address, body, project: noProject ? '' : SOON_PROJECT_ID };
  return walletSpy.mockReturnValue(Promise.resolve(decodedToken));
};

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
  network?: Network,
) => {
  for (let attempt = 0; attempt < 400; ++attempt) {
    await new Promise((r) => setTimeout(r, 500));
    const doc = await build5Db()
      .doc(
        `${COL.MILESTONE + (network ? `_${network}` : '')}/${nextMilestone}/${
          SUB_COL.TRANSACTIONS
        }/${defTranId}`,
      )
      .get<Record<string, unknown>>();
    if (doc?.processed) {
      return;
    }
  }
  throw new Error('Milestone was not processed. Id: ' + nextMilestone);
};

export const submitMilestoneFunc = async (
  address: NetworkAddress,
  amount: number,
  network?: Network,
) => submitMilestoneOutputsFunc([{ address, amount }], network);

export const submitMilestoneOutputsFunc = async <T>(outputs: T[], network?: Network) => {
  const milestoneColl = build5Db().collection(
    (COL.MILESTONE + (network ? `_${network}` : '')) as COL,
  );
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

export const setProdTiers = async () => {
  const soonProjDocRef = build5Db().doc(`${COL.PROJECT}/${SOON_PROJECT_ID}`);
  const soonProject = {
    config: {
      tiers: [0, 10, 4000, 6000, 15000].map((v) => v * MIN_IOTA_AMOUNT),
      tokenTradingFeeDiscountPercentage: [0, 25, 50, 75, 100],
    },
  };
  await soonProjDocRef.set(soonProject, true);
};

export const setTestTiers = async () => {
  const soonProjDocRef = build5Db().doc(`${COL.PROJECT}/${SOON_PROJECT_ID}`);
  const soonProject = {
    config: {
      tiers: [0, 0, 0, 0, 0].map((v) => v * MIN_IOTA_AMOUNT),
      tokenTradingFeeDiscountPercentage: [0, 0, 0, 0, 0],
    },
  };
  await soonProjDocRef.set(soonProject, true);
};
