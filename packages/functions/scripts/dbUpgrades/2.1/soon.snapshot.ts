import { FirebaseApp } from '@build-5/database';
import { COL, Network, SUB_COL, TokenDrop, TokenDropStatus } from '@build-5/interfaces';
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
import dayjs from 'dayjs';
import admin from 'firebase-admin';
import { chunk, flatMap, head, last } from 'lodash';

const consumedOutputs: Set<string> = new Set();

const limit = 1000;

let tokensPerAddress: { [key: string]: number } = {};

let SOON_TOKEN_ID =
  '0x0884298fe9b82504d26ddb873dbd234a344c120da3a4317d8063dbcf96d356aa9d0100000000';
let NETWORK: Network.SMR | Network.RMS = Network.SMR;
let MILESTONE_COL = COL.MILESTONE_SMR;
let MIN_MILESTONE = 125439;

export const soonSnapshot = async (
  app: FirebaseApp,
  tokenId?: string,
  network?: Network.SMR | Network.RMS,
) => {
  SOON_TOKEN_ID = tokenId === undefined ? SOON_TOKEN_ID : tokenId;
  NETWORK = network === undefined ? NETWORK : network;
  MILESTONE_COL = NETWORK === Network.SMR ? COL.MILESTONE_SMR : COL.MILESTONE_RMS;
  tokensPerAddress = {};

  const instance = app.getInstance() as admin.app.App;
  const firestore = instance.firestore();

  const tokensPerMember = await createSoonSnapshot(firestore);

  const chunks = chunk(Object.entries(tokensPerMember), 500);
  for (const chunk of chunks) {
    const batch = firestore.batch();

    for (const [address, count] of chunk) {
      const docRef = firestore.doc(`${COL.SOON_SNAP}/${address}`);
      batch.set(docRef, {
        uid: address,
        createdOn: dayjs().toDate(),

        count,
        paidOut: 0,

        ethAddress: address.startsWith('0x') ? address : '',
        ethAddressVerified: false,
      });
    }

    await batch.commit();
  }

  return tokensPerMember;
};

const createSoonSnapshot = async (db: admin.firestore.Firestore) => {
  let lastDoc: any = undefined;

  do {
    let query = db.collection(MILESTONE_COL).orderBy('createdOn', 'desc').limit(limit);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const milestoneSnapshot = await query.get();
    lastDoc = last(milestoneSnapshot.docs);

    const milestones = milestoneSnapshot.docs.map((d) => d.id);
    const transactions = await getTransactions(db, milestones);

    for (const transaction of transactions) {
      const payload = transaction.payload as TransactionPayload;
      const essence = payload.essence as RegularTransactionEssence;

      updateConsumedOutputs(essence);
      await processTransactions(payload);
    }
  } while (lastDoc && Number(lastDoc.data().milestone) > MIN_MILESTONE);

  const promises = Object.entries(tokensPerAddress).map((act) =>
    addressToMember(db, act[0], act[1]),
  );

  return (await Promise.all(promises)).reduce(
    (acc, act) => {
      Object.entries(act).forEach(([key, value]) => {
        acc[key] = (acc[key] || 0) + value;
      });
      return acc;
    },
    {} as { [key: string]: number },
  );
};

const addressToMember = async (db: admin.firestore.Firestore, address: string, count: number) => {
  const tokensPerMember: { [key: string]: number } = {};
  const airdropsSnap = await db
    .collection(COL.AIRDROP)
    .where('sourceAddress', '==', address)
    .where('status', '==', TokenDropStatus.UNCLAIMED)
    .get();

  for (const doc of airdropsSnap.docs) {
    const airdrop = doc.data() as TokenDrop;

    const memberSnap = await db
      .collection(COL.MEMBER)
      .where(`validatedAddress.${NETWORK}`, '==', airdrop.member)
      .limit(1)
      .get();
    const memberAddress =
      head(memberSnap.docs)?.data().validatedAddress?.[NETWORK] || airdrop.member;

    tokensPerMember[memberAddress] = (tokensPerMember[memberAddress] || 0) + airdrop.count;
  }

  if (airdropsSnap.size) {
    return tokensPerMember;
  }

  const memberSnap = await db
    .collection(COL.MEMBER)
    .where(`validatedAddress.${NETWORK}`, '==', address)
    .get();
  const memberAddress = head(memberSnap.docs)?.data().validatedAddress?.[NETWORK] || address;
  tokensPerMember[memberAddress] = (tokensPerMember[memberAddress] || 0) + count;

  return tokensPerMember;
};

const getTransactions = async (db: admin.firestore.Firestore, milestones: string[]) => {
  const promises = milestones.map(async (milestone) => {
    const snap = await db
      .collection(MILESTONE_COL)
      .doc(milestone)
      .collection(SUB_COL.TRANSACTIONS)
      .get();
    return snap.docs.map((d) => d.data());
  });
  return flatMap(await Promise.all(promises));
};

const processTransactions = async (payload: TransactionPayload) => {
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
