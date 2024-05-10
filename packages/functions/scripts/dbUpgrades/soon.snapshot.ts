import { MilestoneTransactions, database } from '@buildcore/database';
import { COL, Member, Network, SUB_COL, TokenDropStatus } from '@buildcore/interfaces';
import {
  Address,
  AddressType,
  AddressUnlockCondition,
  AliasAddress,
  AliasOutput,
  BasicOutput,
  Ed25519Address,
  GovernorAddressUnlockCondition,
  InputType,
  NftAddress,
  NftOutput,
  OutputType,
  RegularTransactionEssence,
  StateControllerAddressUnlockCondition,
  TransactionPayload,
  UTXOInput,
  UnlockConditionType,
  Utils,
} from '@iota/sdk';
import { chunk, head, last } from 'lodash';

const consumedOutputs: Set<string> = new Set();
const limit = 10000;
let tokensPerAddress: { [key: string]: number } = {};
let members: { [key: string]: Member } = {};

let SOON_TOKEN_ID =
  '0x0884298fe9b82504d26ddb873dbd234a344c120da3a4317d8063dbcf96d356aa9d0100000000';
let NETWORK: Network.SMR | Network.RMS = Network.SMR;
let MILESTONE_COL: COL.MILESTONE_SMR | COL.MILESTONE_RMS = COL.MILESTONE_SMR;
let MIN_MILESTONE = 125438;

export const soonSnapshot = async (tokenId?: string, network?: Network.SMR | Network.RMS) => {
  SOON_TOKEN_ID = tokenId === undefined ? SOON_TOKEN_ID : tokenId;
  NETWORK = network === undefined ? NETWORK : network;
  MILESTONE_COL = NETWORK === Network.SMR ? COL.MILESTONE_SMR : COL.MILESTONE_RMS;
  tokensPerAddress = {};

  const deleted = await database().getCon()(COL.SOON_SNAP).delete();
  console.log('deleted', deleted);

  members = (await database().collection(COL.MEMBER).get()).reduce(
    (acc, act) => ({ ...acc, [act.uid]: act }),
    {},
  );
  console.log('members', Object.keys(members).length);

  await createSoonSnapshot();
  const tokensPerMember = await addressesToMembers();

  const batches = chunk(Object.entries(tokensPerMember), 500);

  let count = 0;
  console.log('saving soon snapshots', 'total', Object.entries(tokensPerMember).length);
  for (const batch of batches) {
    const data = batch.map(([address, count]) => ({
      uid: address,

      count,
      paidOut: 0,

      ethAddress: address.startsWith('0x') ? address : '',
      ethAddressVerified: false,
    }));
    await database().getCon()(COL.SOON_SNAP).insert(data);

    count += batch.length;
    console.log('saving soon snapshots', 'count', count);
  }

  return tokensPerMember;
};

const createSoonSnapshot = async () => {
  let lastDoc: MilestoneTransactions | undefined = undefined;
  let firstMilestone = 0;

  do {
    const transactions: MilestoneTransactions[] = await database()
      .collection(MILESTONE_COL as COL.MILESTONE_SMR, undefined, SUB_COL.TRANSACTIONS)
      .orderBy('createdOn', 'desc')
      .startAfter(lastDoc)
      .limit(limit)
      .get();

    lastDoc = last(transactions);

    if (!firstMilestone) {
      firstMilestone = head(transactions)?.milestone || 0;
      console.log('Processing started from milestone ', firstMilestone);
    }

    console.log('Last milestone ', lastDoc?.milestone);

    for (const transaction of transactions) {
      const payload = transaction.payload as TransactionPayload;
      const essence = payload.essence as RegularTransactionEssence;

      updateConsumedOutputs(essence);
      processTransactions(payload);
    }
  } while (lastDoc && Number(lastDoc.milestone) > MIN_MILESTONE);
};

const addressesToMembers = async () => {
  const tokensPerMember: { [key: string]: number } = {};

  const batches = chunk(Object.entries(tokensPerAddress), 10);
  let count = 0;
  console.log('addressesToMembers', 'total', Object.entries(tokensPerAddress).length);

  for (const batch of batches) {
    const promises = batch.map(([address, count]) => addressToMember(address, count));

    (await Promise.all(promises)).forEach((act) => {
      Object.entries(act).forEach(([key, value]) => {
        tokensPerMember[key] = (tokensPerMember[key] || 0) + value;
      });
    });
    count += batch.length;
    console.log('addressesToMembers', 'count', count);
  }

  return tokensPerMember;
};

const addressToMember = async (address: string, count: number) => {
  const tokensPerMember: { [key: string]: number } = {};
  console.log('addressToMember', 'getting airdrops', address);
  const airdropsSnap = await database()
    .collection(COL.AIRDROP)
    .where('sourceAddress', '==', address)
    .where('status', '==', TokenDropStatus.UNCLAIMED)
    .get();
  console.log('addressToMember', 'airdrops', address, airdropsSnap.length);

  for (const airdrop of airdropsSnap) {
    if (airdrop.member.startsWith('0x')) {
      const member =
        members[airdrop.member] || (await database().doc(COL.MEMBER, airdrop.member).get());
      const memberAddress = member?.validatedAddress?.[NETWORK] || airdrop.member;
      tokensPerMember[memberAddress] = (tokensPerMember[memberAddress] || 0) + airdrop.count;
      continue;
    }

    tokensPerMember[airdrop.member] = (tokensPerMember[airdrop.member] || 0) + airdrop.count;
  }

  if (airdropsSnap.length) {
    return tokensPerMember;
  }

  tokensPerMember[address] = (tokensPerMember[address] || 0) + count;
  return tokensPerMember;
};

const processTransactions = (payload: TransactionPayload) => {
  const essence = payload.essence as RegularTransactionEssence;

  const outputs = essence.outputs.filter(
    (o, i) =>
      [OutputType.Alias, OutputType.Basic, OutputType.Nft].includes(o.type) &&
      !consumedOutputs.has(Utils.computeOutputId(Utils.transactionId(payload), i)),
  );

  for (const output of outputs) {
    const result = getAddressAndSoons(output as AliasOutput | BasicOutput | NftOutput);
    if (result.tokens) {
      tokensPerAddress[result.address] = (tokensPerAddress[result.address] || 0) + result.tokens;
    }
  }
};

const updateConsumedOutputs = (essence: RegularTransactionEssence) => {
  for (const input of essence.inputs) {
    if (input.type === InputType.UTXO) {
      const i = input as UTXOInput;
      consumedOutputs.add(Utils.computeOutputId(i.transactionId, i.transactionOutputIndex));
    }
  }
};

const getAddressAndSoons = (output: AliasOutput | BasicOutput | NftOutput) => {
  const soonTokens = getSoonTokenCount(output);
  if (!soonTokens) {
    return { tokens: 0, address: '' };
  }
  const address = bech32FromUnlockConditions(output, NETWORK);
  return { tokens: soonTokens, address };
};

const getSoonTokenCount = (output: BasicOutput | AliasOutput | NftOutput) =>
  (output.nativeTokens || [])
    .filter((nt) => nt.id === SOON_TOKEN_ID)
    .reduce((acc, act) => acc + Number(act.amount), 0);

const bech32FromUnlockConditions = (output: BasicOutput, hrp: string) =>
  addressToBech32(getUnlockCondition(output)?.address, hrp);

const getUnlockCondition = (output: AliasOutput | BasicOutput | NftOutput) => {
  if (output.type === OutputType.Basic || output.type === OutputType.Nft) {
    return output.unlockConditions.find(
      (c) => c.type === UnlockConditionType.Address,
    ) as AddressUnlockCondition;
  }

  const condition = output.unlockConditions.find(
    (c) => c.type === UnlockConditionType.GovernorAddress,
  ) as GovernorAddressUnlockCondition;
  return (condition ||
    output.unlockConditions.find(
      (c) => c.type === UnlockConditionType.StateControllerAddress,
    )) as StateControllerAddressUnlockCondition;
};

const addressToBech32 = (address: Address, hrp: string) => {
  switch (address.type) {
    case AddressType.Ed25519:
      return Utils.hexToBech32((address as Ed25519Address).pubKeyHash, hrp);
    case AddressType.Alias:
      return Utils.aliasIdToBech32((address as AliasAddress).aliasId, hrp);
    case AddressType.Nft:
      return Utils.aliasIdToBech32((address as NftAddress).nftId, hrp);
  }
};

export const roll = soonSnapshot;
