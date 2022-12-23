/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  addressBalance,
  ALIAS_UNLOCK_TYPE,
  Bech32Helper,
  ED25519_ADDRESS_TYPE,
  IAliasOutput,
  IEd25519Address,
  IFoundryOutput,
  IGovernorAddressUnlockCondition,
  IMetadataFeature,
  IndexerPluginClient,
  METADATA_FEATURE_TYPE,
  REFERENCE_UNLOCK_TYPE,
  TransactionHelper,
  UnlockTypes,
} from '@iota/iota.js-next';
import { Converter, HexHelper } from '@iota/util.js-next';
import {
  COL,
  KEY_NAME_TANGLE,
  Member,
  MIN_IOTA_AMOUNT,
  Network,
  Space,
  SUB_COL,
  Token,
  TokenDistribution,
  TokenStatus,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
  Transaction,
  TransactionMintTokenType,
  TransactionType,
  WenError,
} from '@soonaverse/interfaces';
import bigInt from 'big-integer';
import dayjs from 'dayjs';
import { cloneDeep, isEqual } from 'lodash';
import admin from '../src/admin.config';
import { mintTokenOrder } from '../src/controls/token-minting/token-mint.control';
import { tradeToken } from '../src/controls/token-trading/token-trade.controller';
import { cancelPublicSale, setTokenAvailableForSale } from '../src/controls/token.control';
import { SmrWallet } from '../src/services/wallet/SmrWalletService';
import { AddressDetails } from '../src/services/wallet/wallet';
import { getAddress } from '../src/utils/address.utils';
import { packBasicOutput } from '../src/utils/basic-output.utils';
import { packEssence, packPayload, submitBlock } from '../src/utils/block.utils';
import { dateToTimestamp, serverTime } from '../src/utils/dateTime.utils';
import { createUnlock } from '../src/utils/smr.utils';
import * as wallet from '../src/utils/wallet.utils';
import {
  createMember,
  createSpace,
  expectThrow,
  getRandomSymbol,
  milestoneProcessed,
  mockWalletReturnValue,
  submitMilestoneFunc,
  wait,
} from '../test/controls/common';
import { getWallet, MEDIA, testEnv } from '../test/set-up';
import { awaitTransactionConfirmationsForToken } from './common';
import { requestFundsFromFaucet } from './faucet';

let walletSpy: any;
const network = Network.RMS;
const totalSupply = 1500;

const saveToken = async (space: string, guardian: string, member: string) => {
  const tokenId = wallet.getRandomEthAddress();
  const token = {
    symbol: getRandomSymbol(),
    totalSupply,
    approved: true,
    updatedOn: serverTime(),
    createdOn: serverTime(),
    space,
    uid: tokenId,
    createdBy: guardian,
    name: 'MyToken',
    status: TokenStatus.AVAILABLE,
    access: 0,
    icon: MEDIA,
  };
  await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).set(token);
  await admin
    .firestore()
    .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${member}`)
    .set({ tokenOwned: 1000 });
  return <Token>token;
};

describe('Token minting', () => {
  let guardian: Member;
  let address: AddressDetails;
  let space: Space;
  let token: Token;
  let walletService: SmrWallet;
  let member: string;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
  });

  const setup = async () => {
    const guardianId = await createMember(walletSpy);
    member = await createMember(walletSpy);
    guardian = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${guardianId}`).get()).data();
    space = await createSpace(walletSpy, guardian.uid);
    token = await saveToken(space.uid, guardian.uid, member);
    walletService = (await getWallet(network)) as SmrWallet;
    address = await walletService.getAddressDetails(getAddress(guardian, network));
  };

  it.each([false, true])('Should mint token', async (hasExpiration: boolean) => {
    const expiresAt = hasExpiration ? dateToTimestamp(dayjs().add(2, 'h').toDate()) : undefined;

    await setup();
    mockWalletReturnValue(walletSpy, guardian.uid, { token: token.uid, network });
    const order = await testEnv.wrap(mintTokenOrder)({});
    await requestFundsFromFaucet(
      network,
      order.payload.targetAddress,
      order.payload.amount,
      expiresAt,
    );

    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}`);
    await wait(async () => {
      const snap = await tokenDocRef.get();
      return snap.data()?.status === TokenStatus.MINTED;
    });

    token = <Token>(await tokenDocRef.get()).data();
    expect(token.status).toBe(TokenStatus.MINTED);
    expect(token.mintingData?.tokenId).toBeDefined();
    expect(token.mintingData?.aliasId).toBeDefined();
    expect(token.mintingData?.aliasBlockId).toBeDefined();
    expect(token.mintingData?.blockId).toBeDefined();
    expect(token.mintingData?.mintedBy).toBe(guardian.uid);
    expect(token.mintingData?.mintedOn).toBeDefined();
    expect(token.mintingData?.vaultAddress).toBe(order.payload.targetAddress);
    expect(token.mintingData?.tokensInVault).toBe(1000);
    expect(token.mintingData?.meltedTokens).toBe(0);
    expect(token.mintingData?.circulatingSupply).toBe(token.totalSupply);
    expect(token.ipfsMedia).toBeDefined();
    expect(token.ipfsMetadata).toBeDefined();
    expect(token.ipfsRoot).toBeDefined();

    await wait(async () => {
      const balance = await addressBalance(walletService.client, token.mintingData?.vaultAddress!);
      return Number(Object.values(balance.nativeTokens)[0]) === 1000;
    });
    const guardianData = <Member>(
      (await admin.firestore().doc(`${COL.MEMBER}/${guardian.uid}`).get()).data()
    );
    await wait(async () => {
      const balance = await addressBalance(walletService.client, getAddress(guardianData, network));
      return Number(Object.values(balance.nativeTokens)[0]) === 500;
    });

    await wait(async () => {
      const aliasOutput = await getAliasOutput(walletService, token.mintingData?.aliasId!);
      const addresses = await getStateAndGovernorAddress(walletService, aliasOutput);
      return isEqual(addresses, [address.bech32, address.bech32]);
    });

    const mintTransactions = (
      await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('payload.token', '==', token.uid)
        .where('type', '==', TransactionType.MINT_TOKEN)
        .get()
    ).docs.map((d) => <Transaction>d.data());
    const aliasTran = mintTransactions.find(
      (t) => t.payload.type === TransactionMintTokenType.MINT_ALIAS,
    );
    expect(aliasTran?.payload?.amount).toBe(token.mintingData?.aliasStorageDeposit);
    const foundryTran = mintTransactions.find(
      (t) => t.payload.type === TransactionMintTokenType.MINT_FOUNDRY,
    );
    expect(foundryTran?.payload?.amount).toBe(
      token.mintingData?.foundryStorageDeposit! +
        token.mintingData?.vaultStorageDeposit! +
        token.mintingData?.guardianStorageDeposit!,
    );
    const aliasTransferTran = mintTransactions.find(
      (t) => t.payload.type === TransactionMintTokenType.SEND_ALIAS_TO_GUARDIAN,
    );
    expect(aliasTransferTran?.payload?.amount).toBe(token.mintingData?.aliasStorageDeposit);

    const indexer = new IndexerPluginClient(walletService.client);
    const foundryOutputId = (await indexer.foundry(token.mintingData?.tokenId!)).items[0];
    const foundryOutput = (await walletService.client.output(foundryOutputId)).output;
    const metadata = getFoundryMetadata(foundryOutput as IFoundryOutput);
    expect(metadata.standard).toBe('IRC30');
    expect(metadata.type).toBe('image/png');
    expect(metadata.name).toBe(token.name);
    expect(metadata.uri).toBeDefined();
    expect(metadata.issuerName).toBe(KEY_NAME_TANGLE);
    expect(metadata.soonaverseId).toBe(token.uid);
    expect(metadata.symbol).toBe(token.symbol.toLowerCase());
    expect(metadata.decimals).toBe(6);
  });

  it('Should mint token and melt some', async () => {
    await setup();
    mockWalletReturnValue(walletSpy, guardian.uid, { token: token.uid, network });
    const order = await testEnv.wrap(mintTokenOrder)({});
    await requestFundsFromFaucet(network, order.payload.targetAddress, order.payload.amount);

    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}`);
    await wait(async () => {
      token = <Token>(await tokenDocRef.get()).data();
      return token.status === TokenStatus.MINTED;
    });

    const guardianData = <Member>(
      (await admin.firestore().doc(`${COL.MEMBER}/${guardian.uid}`).get()).data()
    );
    const guardianAddress = getAddress(guardianData, network);
    await wait(async () => {
      const balance = await addressBalance(walletService.client, guardianAddress);
      return Number(Object.values(balance.nativeTokens)[0]) === 500;
    });

    await meltMintedToken(walletService, token, 250, guardianAddress);

    await wait(async () => {
      token = <Token>(await tokenDocRef.get()).data();
      return (
        token.mintingData?.meltedTokens === 250 && token.mintingData?.circulatingSupply === 1250
      );
    });
  });

  it('Should create order, not approved but public', async () => {
    await setup();
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}`)
      .update({ approved: false, public: true });
    mockWalletReturnValue(walletSpy, guardian.uid, { token: token.uid, network });
    const order = await testEnv.wrap(mintTokenOrder)({});
    expect(order).toBeDefined();
  });

  it('Should throw, member has no valid address', async () => {
    await setup();
    await admin.firestore().doc(`${COL.MEMBER}/${guardian.uid}`).update({ validatedAddress: {} });
    mockWalletReturnValue(walletSpy, guardian.uid, { token: token.uid, network });
    await expectThrow(
      testEnv.wrap(mintTokenOrder)({}),
      WenError.member_must_have_validated_address.key,
    );
  });

  it('Should throw, not guardian', async () => {
    await setup();
    mockWalletReturnValue(walletSpy, wallet.getRandomEthAddress(), { token: token.uid, network });
    await expectThrow(testEnv.wrap(mintTokenOrder)({}), WenError.you_are_not_guardian_of_space.key);
  });

  it('Should throw, already minted', async () => {
    await setup();
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ status: TokenStatus.MINTED });
    mockWalletReturnValue(walletSpy, guardian.uid, { token: token.uid, network });
    await expectThrow(testEnv.wrap(mintTokenOrder)({}), WenError.token_in_invalid_status.key);
  });

  it('Should throw, not approved and not public', async () => {
    await setup();
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}`)
      .update({ approved: false, public: false });
    mockWalletReturnValue(walletSpy, guardian.uid, { token: token.uid, network });
    await expectThrow(testEnv.wrap(mintTokenOrder)({}), WenError.token_not_approved.key);
  });

  it('Should credit, already minted', async () => {
    await setup();
    mockWalletReturnValue(walletSpy, guardian.uid, { token: token.uid, network });
    const order = await testEnv.wrap(mintTokenOrder)({});
    const order2 = await testEnv.wrap(mintTokenOrder)({});

    await requestFundsFromFaucet(network, order.payload.targetAddress, order.payload.amount);
    await requestFundsFromFaucet(network, order2.payload.targetAddress, order2.payload.amount);

    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}`);
    await wait(async () => {
      const snap = await tokenDocRef.get();
      return snap.data()?.status === TokenStatus.MINTED;
    });
    await wait(async () => {
      const snap = await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT)
        .where('member', '==', guardian.uid)
        .get();
      return snap.size > 0;
    });
    await awaitTransactionConfirmationsForToken(token.uid);
  });

  it('Should cancel all active buys', async () => {
    await setup();
    const request = {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 5,
      type: TokenTradeOrderType.BUY,
    };
    mockWalletReturnValue(walletSpy, guardian.uid, request);

    const order = await testEnv.wrap(tradeToken)({});
    const milestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(milestone.milestone, milestone.tranId);

    const order2 = await testEnv.wrap(tradeToken)({});
    const milestone2 = await submitMilestoneFunc(
      order2.payload.targetAddress,
      order2.payload.amount,
    );
    await milestoneProcessed(milestone2.milestone, milestone2.tranId);

    await wait(async () => {
      const buySnap = await admin
        .firestore()
        .collection(COL.TOKEN_MARKET)
        .where('type', '==', TokenTradeOrderType.BUY)
        .where('owner', '==', guardian.uid)
        .get();
      return buySnap.size === 2;
    });

    mockWalletReturnValue(walletSpy, guardian.uid, { token: token.uid, network });
    const mintOrder = await testEnv.wrap(mintTokenOrder)({});
    await requestFundsFromFaucet(
      network,
      mintOrder.payload.targetAddress,
      mintOrder.payload.amount,
    );

    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}`);
    await wait(async () => {
      const snap = await tokenDocRef.get();
      return snap.data()?.status === TokenStatus.MINTING;
    });

    await wait(async () => {
      const buySnap = await admin
        .firestore()
        .collection(COL.TOKEN_MARKET)
        .where('type', '==', TokenTradeOrderType.BUY)
        .where('status', '==', TokenTradeOrderStatus.CANCELLED_MINTING_TOKEN)
        .where('owner', '==', guardian.uid)
        .get();
      return buySnap.size === 2;
    });

    await wait(async () => {
      const creditSnap = await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT)
        .where('member', '==', guardian.uid)
        .get();
      return creditSnap.size === 2;
    });
  });

  it('Should cancel all active sells', async () => {
    await setup();

    const request = {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 500,
      type: TokenTradeOrderType.SELL,
    };
    mockWalletReturnValue(walletSpy, member, request);
    await testEnv.wrap(tradeToken)({});
    await testEnv.wrap(tradeToken)({});

    mockWalletReturnValue(walletSpy, guardian.uid, { token: token.uid, network });
    const mintOrder = await testEnv.wrap(mintTokenOrder)({});
    await requestFundsFromFaucet(
      network,
      mintOrder.payload.targetAddress,
      mintOrder.payload.amount,
    );

    await wait(async () => {
      const snap = await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).get();
      return snap.data()?.status === TokenStatus.MINTING;
    });

    await wait(async () => {
      const sellSnap = await admin
        .firestore()
        .collection(COL.TOKEN_MARKET)
        .where('type', '==', TokenTradeOrderType.SELL)
        .where('status', '==', TokenTradeOrderStatus.CANCELLED_MINTING_TOKEN)
        .where('owner', '==', member)
        .get();
      return sellSnap.size === 2;
    });

    const distribution = <TokenDistribution>(
      (
        await admin
          .firestore()
          .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${member}`)
          .get()
      ).data()
    );
    expect(distribution.lockedForSale).toBe(0);
    expect(distribution.tokenOwned).toBe(1000);
  });

  it('Should throw, can not mint token before or during public sale', async () => {
    await setup();
    const publicTime = {
      saleStartDate: dayjs().add(2, 'd').toDate(),
      saleLength: 86400000 * 2,
      coolDownLength: 86400000,
    };
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}`)
      .update({ allocations: [{ title: 'public', percentage: 100, isPublicSale: true }] });
    const updateData = { token: token.uid, ...publicTime, pricePerToken: MIN_IOTA_AMOUNT };
    mockWalletReturnValue(walletSpy, guardian.uid, updateData);
    const result = await testEnv.wrap(setTokenAvailableForSale)({});
    expect(result?.saleStartDate.toDate()).toEqual(
      dateToTimestamp(dayjs(publicTime.saleStartDate), true).toDate(),
    );

    mockWalletReturnValue(walletSpy, guardian.uid, { token: token.uid, network });
    await expectThrow(testEnv.wrap(mintTokenOrder)({}), WenError.can_not_mint_in_pub_sale.key);
  });

  it('Should credit, token in public sale', async () => {
    await setup();

    mockWalletReturnValue(walletSpy, guardian.uid, { token: token.uid, network });
    const order = await testEnv.wrap(mintTokenOrder)({});

    const publicTime = {
      saleStartDate: dayjs().add(2, 'd').toDate(),
      saleLength: 86400000 * 2,
      coolDownLength: 86400000,
    };
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}`)
      .update({ allocations: [{ title: 'public', percentage: 100, isPublicSale: true }] });
    const updateData = { token: token.uid, ...publicTime, pricePerToken: MIN_IOTA_AMOUNT };
    mockWalletReturnValue(walletSpy, guardian.uid, updateData);
    await testEnv.wrap(setTokenAvailableForSale)({});

    await requestFundsFromFaucet(network, order.payload.targetAddress, order.payload.amount);

    const creditQuery = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', guardian.uid);
    await wait(async () => {
      const credit = (await creditQuery.get()).docs.map((d) => <Transaction>d.data())[0];
      return credit?.payload?.walletReference?.confirmed;
    });
    const credit = (await creditQuery.get()).docs.map((d) => <Transaction>d.data())[0];
    expect(credit?.payload?.amount).toBe(order.payload.amount);
  });

  it('Should credit, token in public sale, cancel public sale then mint', async () => {
    await setup();

    mockWalletReturnValue(walletSpy, guardian.uid, { token: token.uid, network });
    const order = await testEnv.wrap(mintTokenOrder)({});

    const publicTime = {
      saleStartDate: dayjs().add(2, 'd').toDate(),
      saleLength: 86400000 * 2,
      coolDownLength: 86400000,
    };
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}`)
      .update({ allocations: [{ title: 'public', percentage: 100, isPublicSale: true }] });
    const updateData = { token: token.uid, ...publicTime, pricePerToken: MIN_IOTA_AMOUNT };
    mockWalletReturnValue(walletSpy, guardian.uid, updateData);
    await testEnv.wrap(setTokenAvailableForSale)({});

    await requestFundsFromFaucet(network, order.payload.targetAddress, order.payload.amount);

    const creditQuery = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', guardian.uid);
    await wait(async () => {
      const credit = (await creditQuery.get()).docs.map((d) => <Transaction>d.data())[0];
      return credit?.payload?.walletReference?.confirmed;
    });
    const credit = (await creditQuery.get()).docs.map((d) => <Transaction>d.data())[0];
    expect(credit?.payload?.amount).toBe(order.payload.amount);

    mockWalletReturnValue(walletSpy, guardian.uid, { token: token.uid });
    await testEnv.wrap(cancelPublicSale)({});
    await requestFundsFromFaucet(network, order.payload.targetAddress, order.payload.amount);

    await wait(async () => {
      const tokenData = <Token>(
        (await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).get()).data()
      );
      return tokenData.status === TokenStatus.MINTED;
    });
  });
});

const getAliasOutput = async (wallet: SmrWallet, aliasId: string) => {
  const indexer = new IndexerPluginClient(wallet.client);
  const response = await indexer.alias(aliasId);
  const outputResponse = await wallet.client.output(response.items[0]);
  return outputResponse.output as IAliasOutput;
};

const getStateAndGovernorAddress = async (wallet: SmrWallet, alias: IAliasOutput) => {
  const hrp = wallet.info.protocol.bech32Hrp;
  return (alias.unlockConditions as IGovernorAddressUnlockCondition[])
    .map((uc) => (uc.address as IEd25519Address).pubKeyHash)
    .map((pubHash) =>
      Bech32Helper.toBech32(ED25519_ADDRESS_TYPE, Converter.hexToBytes(pubHash), hrp),
    );
};

const getFoundryMetadata = (foundry: IFoundryOutput | undefined) => {
  try {
    const hexMetadata = <IMetadataFeature | undefined>(
      foundry?.immutableFeatures?.find((f) => f.type === METADATA_FEATURE_TYPE)
    );
    if (!hexMetadata?.data) {
      return {};
    }
    return JSON.parse(Converter.hexToUtf8(hexMetadata.data) || '{}');
  } catch {
    return {};
  }
};

const meltMintedToken = async (
  wallet: SmrWallet,
  token: Token,
  amount: number,
  fromAddress: string,
) => {
  const outputs = await wallet.getOutputs(fromAddress, [], false);
  const nativeTokens = Object.values(outputs)
    .map((o) => o.nativeTokens![0].amount)
    .reduce((acc, act) => acc + Number(act), 0);

  const indexer = new IndexerPluginClient(wallet.client);
  const aliasOutputId = (await indexer.alias(token.mintingData?.aliasId!)).items[0];
  const aliasOutput = <IAliasOutput>(await wallet.client.output(aliasOutputId)).output;

  const foundryOutputId = (await indexer.foundry(token.mintingData?.tokenId!)).items[0];
  const foundryOutput = <IFoundryOutput>(await wallet.client.output(foundryOutputId)).output;

  const nextAliasOutput = cloneDeep(aliasOutput);
  nextAliasOutput.stateIndex++;

  const nextFoundryOutput = cloneDeep(foundryOutput);
  nextFoundryOutput.tokenScheme.meltedTokens = HexHelper.fromBigInt256(bigInt(amount));

  const output = packBasicOutput(
    fromAddress,
    0,
    [
      {
        amount: HexHelper.fromBigInt256(bigInt(nativeTokens - amount)),
        id: token.mintingData?.tokenId!,
      },
    ],
    wallet.info,
  );

  const inputs = [aliasOutputId, foundryOutputId, ...Object.keys(outputs)].map(
    TransactionHelper.inputFromOutputId,
  );
  const inputsCommitment = TransactionHelper.getInputsCommitment([
    aliasOutput,
    foundryOutput,
    ...Object.values(outputs),
  ]);
  const essence = packEssence(
    inputs,
    inputsCommitment,
    [nextAliasOutput, nextFoundryOutput, output],
    wallet,
    {},
  );

  const address = await wallet.getAddressDetails(fromAddress);
  const unlocks: UnlockTypes[] = [
    createUnlock(essence, address.keyPair),
    { type: ALIAS_UNLOCK_TYPE, reference: 0 },
    { type: REFERENCE_UNLOCK_TYPE, reference: 0 },
  ];

  return await submitBlock(wallet, packPayload(essence, unlocks));
};
