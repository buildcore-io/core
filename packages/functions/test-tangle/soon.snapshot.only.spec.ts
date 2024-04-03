import { build5App, build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  SOON_PROJECT_ID,
  SUB_COL,
  SoonSnap,
  TangleRequestType,
  Token,
  TokenDrop,
  TokenDropStatus,
  TokenStatus,
  Transaction,
  TransactionType,
  getMilestoneCol,
} from '@build-5/interfaces';
import {
  AddressUnlockCondition,
  AliasOutputBuilderParams,
  Ed25519Address,
  GovernorAddressUnlockCondition,
  IssuerFeature,
  NftOutputBuilderParams,
  ReferenceUnlock,
  StateControllerAddressUnlockCondition,
  UTXOInput,
  Unlock,
  Utils,
} from '@iota/sdk';
import dayjs from 'dayjs';
import admin from 'firebase-admin';
import { cloneDeep } from 'lodash';
import { soonSnapshot } from '../scripts/dbUpgrades/2.1/soon.snapshot';
import { airdropMintedToken } from '../src/runtime/firebase/token/minting';
import { MnemonicService } from '../src/services/wallet/mnemonic';
import { Wallet } from '../src/services/wallet/wallet';
import { AddressDetails } from '../src/services/wallet/wallet.service';
import { mergeOutputs } from '../src/utils/basic-output.utils';
import { createUnlock, packEssence, submitBlock } from '../src/utils/block.utils';
import { EMPTY_NFT_ID } from '../src/utils/collection-minting-utils/nft.utils';
import { dateToTimestamp } from '../src/utils/dateTime.utils';
import { EMPTY_ALIAS_ID } from '../src/utils/token-minting-utils/alias.utils';
import * as walletUtils from '../src/utils/wallet.utils';
import {
  createMember,
  createSpace,
  getRandomSymbol,
  mockWalletReturnValue,
  wait,
} from '../test/controls/common';
import { getWallet, testEnv } from '../test/set-up';
import { awaitTransactionConfirmationsForToken, getTangleOrder } from './common';
import { requestFundsFromFaucet, requestMintedTokenFromFaucet } from './faucet';

const tokenId = '0x08e232e6541a81d2b2c0df252e90d8ba4e6fc6680f668fc266b1e43fc3cc01f4830100000000';
const vaultAddress = 'rms1qpukey66jkfnpvyf968ewld9df5ymfudaw7hfrry4ad3jgaxg7kp2qsz5uv';
const vaultMnemonic =
  'slender bag negative song swallow can inform used grocery old camp scatter develop surface lock clutch year hat oyster crack obvious first member dog';

describe('Soon snapshot test', () => {
  const network = Network.RMS;
  let guardian: string;
  let wallet: Wallet;
  let address: AddressDetails;
  let targetAddress: AddressDetails;
  let currentSoonTotal: number;
  let walletSpy: any;
  let token: Token;
  let tangleOrder: Transaction;

  beforeAll(async () => {
    wallet = await getWallet(network);
    tangleOrder = await getTangleOrder(Network.RMS);
  });

  beforeEach(async () => {
    walletSpy = jest.spyOn(walletUtils, 'decodeAuth');

    address = await wallet.getNewIotaAddressDetails();
    targetAddress = await wallet.getNewIotaAddressDetails();

    guardian = await createMember(walletSpy);
    await build5Db()
      .doc(`${COL.MEMBER}/${guardian}`)
      .update({ [`validatedAddress.${network}`]: address.bech32 });
    const space = await createSpace(walletSpy, guardian);

    const db = (build5App.getInstance() as admin.app.App).firestore();
    let snap = await db.collectionGroup(SUB_COL.TRANSACTIONS).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
    snap = await db.collection(getMilestoneCol(network)).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));

    currentSoonTotal = (await wallet.getBalance(vaultAddress)).nativeTokens[tokenId];
    currentSoonTotal -= 100;

    await requestFundsFromFaucet(network, address.bech32, 5 * MIN_IOTA_AMOUNT);

    const blockId = await requestMintedTokenFromFaucet(
      wallet,
      address,
      tokenId,
      vaultMnemonic,
      100,
    );
    await blockInDd(blockId);

    token = {
      project: SOON_PROJECT_ID,
      createdBy: guardian,
      symbol: getRandomSymbol(),
      uid: tokenId,
      space: space.uid,
      status: TokenStatus.MINTED,
      mintingData: {
        tokenId,
        network,
      },
      approved: true,
    } as Token;
    await build5Db().doc(`${COL.TOKEN}/${tokenId}`).set(token);
  });

  it('Should get 100 token from vault and claim it', async () => {
    const tokensPerMember = await soonSnapshot(build5App, tokenId, network);
    expect(tokensPerMember[vaultAddress]).toBe(currentSoonTotal);
    expect(tokensPerMember[address.bech32]).toBe(100);

    let snapshot = await build5Db().doc(`${COL.SOON_SNAP}/${vaultAddress}`).get<SoonSnap>();
    expect(snapshot?.uid).toBe(vaultAddress);
    expect(snapshot?.count).toBe(currentSoonTotal);
    expect(snapshot?.paidOut).toBe(0);
    expect(snapshot?.ethAddress).toBe('');
    expect(snapshot?.ethAddressVerified).toBe(false);

    snapshot = await build5Db().doc(`${COL.SOON_SNAP}/${address.bech32}`).get<SoonSnap>();
    expect(snapshot?.uid).toBe(address.bech32);
    expect(snapshot?.count).toBe(100);
    expect(snapshot?.paidOut).toBe(0);
    expect(snapshot?.ethAddress).toBe('');
    expect(snapshot?.ethAddressVerified).toBe(false);

    const ethAddress = walletUtils.getRandomEthAddress();
    await wallet.send(address, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: { requestType: TangleRequestType.VERIFY_ETH_ADDRESS, ethAddress },
      },
    });
    await MnemonicService.store(address.bech32, address.mnemonic);

    const creditQuery = build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST)
      .where('member', '==', guardian);
    await wait(async () => {
      const snap = await creditQuery.get<Transaction>();
      return snap.length === 1 && snap[0].payload.walletReference?.confirmed;
    });

    const docRef = build5Db().doc(`${COL.SOON_SNAP}/${address.bech32}`);
    snapshot = await docRef.get<SoonSnap>();
    expect(snapshot?.uid).toBe(address.bech32);
    expect(snapshot?.count).toBe(100);
    expect(snapshot?.paidOut).toBe(0);
    expect(snapshot?.ethAddress).toBe(ethAddress);
    expect(snapshot?.ethAddressVerified).toBe(true);
    await docRef.update({ paidOut: snapshot!.count });

    await wallet.send(address, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: { requestType: TangleRequestType.VERIFY_ETH_ADDRESS, ethAddress },
      },
    });

    await wait(async () => {
      const snap = await creditQuery.get<Transaction>();
      return snap.length === 2;
    });

    snapshot = await docRef.get<SoonSnap>();
    expect(snapshot?.uid).toBe(address.bech32);
    expect(snapshot?.count).toBe(100);
    expect(snapshot?.paidOut).toBe(100);
    expect(snapshot?.ethAddress).toBe(ethAddress);
    expect(snapshot?.ethAddressVerified).toBe(true);
  });

  it('Should send 50 to random user, keep 50', async () => {
    const blockId = await wallet.send(address, targetAddress.bech32, MIN_IOTA_AMOUNT / 2, {
      nativeTokens: [{ id: tokenId, amount: BigInt(50) }],
    });
    await blockInDd(blockId);

    const tokensPerMember = await soonSnapshot(build5App, tokenId, network);
    expect(tokensPerMember[vaultAddress]).toBe(currentSoonTotal);
    expect(tokensPerMember[address.bech32]).toBe(50);
    expect(tokensPerMember[targetAddress.bech32]).toBe(50);

    await requestFundsFromFaucet(network, targetAddress.bech32, MIN_IOTA_AMOUNT);
    const ethAddress = walletUtils.getRandomEthAddress();
    await wallet.send(targetAddress, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: { requestType: TangleRequestType.VERIFY_ETH_ADDRESS, ethAddress },
      },
    });
    const creditQuery = build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST)
      .where('member', '==', targetAddress.bech32);
    await wait(async () => {
      const snap = await creditQuery.get<Transaction>();
      return snap.length === 1 && snap[0].payload.walletReference?.confirmed;
    });

    const snapshot = await build5Db()
      .doc(`${COL.SOON_SNAP}/${targetAddress.bech32}`)
      .get<SoonSnap>();
    expect(snapshot?.uid).toBe(targetAddress.bech32);
    expect(snapshot?.count).toBe(50);
    expect(snapshot?.paidOut).toBe(0);
    expect(snapshot?.ethAddress).toBe(ethAddress);
    expect(snapshot?.ethAddressVerified).toBe(true);
  });

  it('Receive 25 back locked', async () => {
    let blockId = await wallet.send(address, targetAddress.bech32, MIN_IOTA_AMOUNT / 2, {
      nativeTokens: [{ id: tokenId, amount: BigInt(50) }],
    });
    await blockInDd(blockId);

    blockId = await wallet.send(targetAddress, address.bech32, 0, {
      nativeTokens: [{ id: tokenId, amount: BigInt(25) }],
      vestingAt: dateToTimestamp(dayjs().add(100, 'd')),
    });
    await blockInDd(blockId);

    const tokensPerMember = await soonSnapshot(build5App, tokenId, network);
    expect(tokensPerMember[vaultAddress]).toBe(currentSoonTotal);
    expect(tokensPerMember[address.bech32]).toBe(75);
    expect(tokensPerMember[targetAddress.bech32]).toBe(25);
  });

  it('Receive 10 back with expiration', async () => {
    let blockId = await wallet.send(address, targetAddress.bech32, MIN_IOTA_AMOUNT / 2, {
      nativeTokens: [{ id: tokenId, amount: BigInt(50) }],
    });
    await blockInDd(blockId);

    blockId = await wallet.send(targetAddress, address.bech32, 0, {
      nativeTokens: [{ id: tokenId, amount: BigInt(10) }],
      expiration: {
        expiresAt: dateToTimestamp(dayjs().add(100, 'd')),
        returnAddressBech32: targetAddress.bech32,
      },
    });
    await blockInDd(blockId);

    const tokensPerMember = await soonSnapshot(build5App, tokenId, network);
    expect(tokensPerMember[vaultAddress]).toBe(currentSoonTotal);
    expect(tokensPerMember[address.bech32]).toBe(60);
    expect(tokensPerMember[targetAddress.bech32]).toBe(40);
  });

  it('Mint nft and store native tokens', async () => {
    const outputs = await wallet.getOutputs(address.bech32, undefined, undefined, false);
    const output = mergeOutputs(cloneDeep(Object.values(outputs)));

    const issuerAddress = new Ed25519Address(address.hex);
    const ownerAddress = new Ed25519Address(targetAddress.hex);

    const nftOutputParams: NftOutputBuilderParams = {
      nftId: EMPTY_NFT_ID,
      immutableFeatures: [new IssuerFeature(issuerAddress)],
      unlockConditions: [new AddressUnlockCondition(ownerAddress)],
      nativeTokens: [{ id: tokenId, amount: BigInt(10) }],
    };
    const nftOutput = await wallet.client.buildNftOutput(nftOutputParams);

    output.amount = (Number(output.amount!) - Number(nftOutput.amount)).toString();
    output.nativeTokens = [
      { id: tokenId, amount: BigInt(Number(output.nativeTokens![0].amount) - 10) },
    ];

    const inputs = Object.keys(outputs).map(UTXOInput.fromOutputId);
    const inputsCommitment = Utils.computeInputsCommitment(Object.values(outputs));

    const essence = await packEssence(
      wallet,
      inputs,
      inputsCommitment,
      [await wallet.client.buildBasicOutput(output), nftOutput],
      {},
    );
    const fromUnlock = await createUnlock(essence, address);
    const unlocks: Unlock[] = Object.values(outputs).map((_, index) =>
      index ? new ReferenceUnlock(0) : fromUnlock,
    );
    const blockId = await submitBlock(wallet, essence, unlocks);
    await build5Db().doc(`blocks/${blockId}`).create({ blockId });
    await blockInDd(blockId);

    const tokensPerMember = await soonSnapshot(build5App, tokenId, network);
    expect(tokensPerMember[vaultAddress]).toBe(currentSoonTotal);
    expect(tokensPerMember[address.bech32]).toBe(90);
    expect(tokensPerMember[targetAddress.bech32]).toBe(10);
  });

  it('Mint alias and store 10 tokens', async () => {
    const outputs = await wallet.getOutputs(address.bech32, undefined, undefined, false);
    const output = mergeOutputs(cloneDeep(Object.values(outputs)));

    const issuerAddress = new Ed25519Address(address.hex);
    const governorAddress = new Ed25519Address(targetAddress.hex);

    const aliasOutputParams: AliasOutputBuilderParams = {
      aliasId: EMPTY_ALIAS_ID,
      stateIndex: 0,
      foundryCounter: 0,
      immutableFeatures: [new IssuerFeature(issuerAddress)],
      unlockConditions: [
        new StateControllerAddressUnlockCondition(governorAddress),
        new GovernorAddressUnlockCondition(governorAddress),
      ],
      nativeTokens: [{ id: tokenId, amount: BigInt(10) }],
    };
    const aliasOutput = await wallet.client.buildAliasOutput(aliasOutputParams);

    output.amount = (Number(output.amount!) - Number(aliasOutput.amount)).toString();
    output.nativeTokens = [
      { id: tokenId, amount: BigInt(Number(output.nativeTokens![0].amount) - 10) },
    ];

    const inputs = Object.keys(outputs).map(UTXOInput.fromOutputId);
    const inputsCommitment = Utils.computeInputsCommitment(Object.values(outputs));

    const essence = await packEssence(
      wallet,
      inputs,
      inputsCommitment,
      [await wallet.client.buildBasicOutput(output), aliasOutput],
      {},
    );
    const fromUnlock = await createUnlock(essence, address);
    const unlocks: Unlock[] = Object.values(outputs).map((_, index) =>
      index ? new ReferenceUnlock(0) : fromUnlock,
    );
    const blockId = await submitBlock(wallet, essence, unlocks);
    await build5Db().doc(`blocks/${blockId}`).create({ blockId });
    await blockInDd(blockId);

    const tokensPerMember = await soonSnapshot(build5App, tokenId, network);
    expect(tokensPerMember[vaultAddress]).toBe(currentSoonTotal);
    expect(tokensPerMember[address.bech32]).toBe(90);
    expect(tokensPerMember[targetAddress.bech32]).toBe(10);
  });

  it('Airdrop 2 * 10 token, unclaimed', async () => {
    const drops = [
      {
        count: 10,
        recipient: targetAddress.bech32,
        vestingAt: dayjs().subtract(1, 'm').toDate(),
      },
      { count: 10, recipient: targetAddress.bech32, vestingAt: dayjs().add(2, 'M').toDate() },
    ];
    mockWalletReturnValue(walletSpy, guardian, { token: tokenId, drops });
    let order = await testEnv.wrap(airdropMintedToken)({});
    const blockId = await wallet.send(address, order.payload.targetAddress, 0, {
      nativeTokens: [{ id: tokenId, amount: BigInt(20) }],
    });
    await MnemonicService.store(address.bech32, address.mnemonic);
    await blockInDd(blockId);

    mockWalletReturnValue(walletSpy, guardian, { token: tokenId, drops });
    order = await testEnv.wrap(airdropMintedToken)({});
    await wallet.send(address, order.payload.targetAddress, 0, {
      nativeTokens: [{ id: tokenId, amount: BigInt(20) }],
    });

    await wait(async () => {
      const snap = await build5Db()
        .collection(COL.AIRDROP)
        .where('member', '==', targetAddress.bech32)
        .get<TokenDrop>();
      const status = snap.reduce(
        (acc, act) => acc && act.status === TokenDropStatus.UNCLAIMED,
        true,
      );
      return snap.length === 4 && status;
    });

    const tokensPerMember = await soonSnapshot(build5App, tokenId, network);
    expect(tokensPerMember[vaultAddress]).toBe(currentSoonTotal);
    expect(tokensPerMember[address.bech32]).toBe(60);
    expect(tokensPerMember[targetAddress.bech32]).toBe(40);
  });

  it('Airdrop 2 * 10 token, claim half, do not count twice', async () => {
    const tmp = await wallet.getNewIotaAddressDetails();
    const drops = [
      {
        count: 10,
        recipient: targetAddress.bech32,
        vestingAt: dayjs().subtract(1, 'm').toDate(),
      },
      { count: 10, recipient: tmp.bech32, vestingAt: dayjs().add(2, 'M').toDate() },
    ];
    mockWalletReturnValue(walletSpy, guardian, { token: tokenId, drops });
    let order = await testEnv.wrap(airdropMintedToken)({});
    const blockId = await wallet.send(address, order.payload.targetAddress, 0, {
      nativeTokens: [{ id: tokenId, amount: BigInt(20) }],
    });
    await MnemonicService.store(address.bech32, address.mnemonic);
    await blockInDd(blockId);

    await requestFundsFromFaucet(network, tmp.bech32, MIN_IOTA_AMOUNT);
    await wallet.send(tmp, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.CLAIM_MINTED_AIRDROPS,
          symbol: token.symbol,
        },
      },
    });
    await MnemonicService.store(tmp.bech32, tmp.mnemonic);

    const orderQuery = build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', tmp.bech32)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST);

    await wait(async () => {
      const snap = await orderQuery.get<Transaction>();
      return snap.length === 1 && snap[0].payload.walletReference?.confirmed;
    });

    const claimOrder = <Transaction>(await orderQuery.get())[0];
    await wallet.send(
      tmp,
      claimOrder.payload.response!.address as string,
      claimOrder.payload.response!.amount as number,
      {},
    );

    mockWalletReturnValue(walletSpy, guardian, { token: tokenId, drops });
    order = await testEnv.wrap(airdropMintedToken)({});
    await wallet.send(address, order.payload.targetAddress, 0, {
      nativeTokens: [{ id: tokenId, amount: BigInt(20) }],
    });

    await wait(async () => {
      const snap = await build5Db()
        .collection(COL.AIRDROP)
        .where('member', 'in', [targetAddress.bech32, tmp.bech32])
        .get<TokenDrop>();
      const claimed = snap.filter((s) => s.status === TokenDropStatus.CLAIMED);
      const unclaimed = snap.filter((s) => s.status === TokenDropStatus.UNCLAIMED);
      return snap.length === 4 && claimed.length === 1 && unclaimed.length === 3;
    });

    await awaitTransactionConfirmationsForToken(tokenId);

    const tokensPerMember = await soonSnapshot(build5App, tokenId, network);
    expect(tokensPerMember[vaultAddress]).toBe(currentSoonTotal);
    expect(tokensPerMember[address.bech32]).toBe(60);
    expect(tokensPerMember[targetAddress.bech32]).toBe(20);
    expect(tokensPerMember[tmp.bech32]).toBe(20);

    let snapshot = await build5Db().doc(`${COL.SOON_SNAP}/${vaultAddress}`).get<SoonSnap>();
    expect(snapshot?.count).toBe(currentSoonTotal);
    snapshot = await build5Db().doc(`${COL.SOON_SNAP}/${address.bech32}`).get<SoonSnap>();
    expect(snapshot?.count).toBe(60);
    snapshot = await build5Db().doc(`${COL.SOON_SNAP}/${targetAddress.bech32}`).get<SoonSnap>();
    expect(snapshot?.count).toBe(20);
    snapshot = await build5Db().doc(`${COL.SOON_SNAP}/${tmp.bech32}`).get<SoonSnap>();
    expect(snapshot?.count).toBe(20);
  });

  it('Airdrop to member with no validated address', async () => {
    const member = await createMember(walletSpy);
    await build5Db().doc(`${COL.MEMBER}/${member}`).update({ validatedAddress: {} });
    const drops = [{ count: 10, recipient: member, vestingAt: dayjs().add(2, 'M').toDate() }];

    mockWalletReturnValue(walletSpy, guardian, { token: tokenId, drops });
    let order = await testEnv.wrap(airdropMintedToken)({});
    const blockId = await wallet.send(address, order.payload.targetAddress, 0, {
      nativeTokens: [{ id: tokenId, amount: BigInt(10) }],
    });
    await MnemonicService.store(address.bech32, address.mnemonic);
    await blockInDd(blockId);

    await wait(async () => {
      const snap = await build5Db()
        .collection(COL.AIRDROP)
        .where('member', '==', member)
        .where('status', '==', TokenDropStatus.UNCLAIMED)
        .get();
      return snap.length === 1;
    });

    const tokensPerMember = await soonSnapshot(build5App, tokenId, network);
    expect(tokensPerMember[vaultAddress]).toBe(currentSoonTotal);
    expect(tokensPerMember[address.bech32]).toBe(90);
    expect(tokensPerMember[member]).toBe(10);

    const tmp = await wallet.getNewIotaAddressDetails();
    await requestFundsFromFaucet(network, tmp.bech32, MIN_IOTA_AMOUNT);
    await wallet.send(tmp, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: { requestType: TangleRequestType.VERIFY_ETH_ADDRESS, ethAddress: member },
      },
    });

    const creditQuery = build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST)
      .where('member', '==', tmp.bech32);
    await wait(async () => {
      const snap = await creditQuery.get<Transaction>();
      return snap.length === 1 && snap[0].payload.walletReference?.confirmed;
    });

    const snapshot = await build5Db().doc(`${COL.SOON_SNAP}/${member}`).get<SoonSnap>();
    expect(snapshot?.uid).toBe(member);
    expect(snapshot?.count).toBe(10);
    expect(snapshot?.paidOut).toBe(0);
    expect(snapshot?.ethAddress).toBe(member);
    expect(snapshot?.ethAddressVerified).toBe(true);
  });
});

const blockInDd = async (blockId: string) => {
  await wait(async () => {
    const snap = await build5Db().collectionGroup(SUB_COL.TRANSACTIONS).get<any>();
    const blockIds = snap.map((s) => s.blockId);
    return blockIds.includes(blockId);
  });
};
