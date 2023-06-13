/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Access,
  COL,
  Categories,
  Collection,
  CollectionStatus,
  CollectionType,
  MIN_IOTA_AMOUNT,
  Member,
  Network,
  Nft,
  NftAccess,
  Space,
  Timestamp,
  Transaction,
  TransactionMintCollectionType,
  TransactionType,
  UnsoldMintingOptions,
} from '@build-5/interfaces';
import {
  ADDRESS_UNLOCK_CONDITION_TYPE,
  Bech32Helper,
  EXPIRATION_UNLOCK_CONDITION_TYPE,
  REFERENCE_UNLOCK_TYPE,
  STORAGE_DEPOSIT_RETURN_UNLOCK_CONDITION_TYPE,
  TAG_FEATURE_TYPE,
  TransactionHelper,
  UnlockTypes,
} from '@iota/iota.js-next';
import { Converter } from '@iota/util.js-next';
import dayjs from 'dayjs';
import { cloneDeep } from 'lodash';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import {
  approveCollection,
  createCollection,
  mintCollection,
} from '../../src/runtime/firebase/collection/index';
import {
  createNft,
  orderNft,
  setForSaleNft,
  withdrawNft,
} from '../../src/runtime/firebase/nft/index';
import { NftWallet } from '../../src/services/wallet/NftWallet';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { AddressDetails } from '../../src/services/wallet/wallet';
import { getAddress } from '../../src/utils/address.utils';
import { mergeOutputs, packBasicOutput } from '../../src/utils/basic-output.utils';
import { packEssence, packPayload, submitBlock } from '../../src/utils/block.utils';
import { EMPTY_NFT_ID } from '../../src/utils/collection-minting-utils/nft.utils';
import { createUnlock } from '../../src/utils/smr.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import {
  createMember as createMemberTest,
  createSpace,
  milestoneProcessed,
  mockWalletReturnValue,
  submitMilestoneFunc,
  wait,
} from '../../test/controls/common';
import { MEDIA, getWallet, testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';

export class Helper {
  public network = Network.RMS;
  public collection: string | undefined;
  public guardian: string | undefined;
  public space: Space | undefined;
  public walletService: SmrWallet | undefined;
  public walletSpy: any;
  public nft: Nft | undefined;
  public guardianAddress: AddressDetails | undefined;
  public royaltySpace: Space | undefined;

  public beforeAll = async () => {
    this.walletSpy = jest.spyOn(wallet, 'decodeAuth');
    this.walletService = (await getWallet(this.network)) as SmrWallet;
  };

  public beforeEach = async () => {
    this.guardian = await createMemberTest(this.walletSpy);
    this.space = await createSpace(this.walletSpy, this.guardian!);
    this.royaltySpace = await createSpace(this.walletSpy, this.guardian!);

    mockWalletReturnValue(
      this.walletSpy,
      this.guardian!,
      this.createDummyCollection(this.space!.uid, this.royaltySpace!.uid),
    );
    this.collection = (await testEnv.wrap(createCollection)({})).uid;

    mockWalletReturnValue(this.walletSpy, this.guardian, { uid: this.collection });
    await testEnv.wrap(approveCollection)({});

    const guardianDocRef = build5Db().doc(`${COL.MEMBER}/${this.guardian}`);
    const guardianData = <Member>await guardianDocRef.get();
    const guardianBech32 = getAddress(guardianData, this.network!);
    this.guardianAddress = await this.walletService?.getAddressDetails(guardianBech32)!;
  };

  public createAndOrderNft = async () => {
    let nft: any = this.createDummyNft(this.collection!);
    delete nft.uid;
    mockWalletReturnValue(this.walletSpy, this.guardian!, nft);
    nft = await testEnv.wrap(createNft)({});

    await build5Db()
      .doc(`${COL.NFT}/${nft.uid}`)
      .update({ availableFrom: dayjs().subtract(1, 'h').toDate() });

    mockWalletReturnValue(this.walletSpy, this.guardian!, {
      collection: this.collection,
      nft: nft.uid,
    });
    const order = await testEnv.wrap(orderNft)({});
    const milestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(milestone.milestone, milestone.tranId);

    this.nft = <Nft>await build5Db().doc(`${COL.NFT}/${nft.uid}`).get();
    return this.nft;
  };

  public mintCollection = async (expiresAt?: Timestamp) => {
    mockWalletReturnValue(this.walletSpy, this.guardian!, {
      collection: this.collection!,
      network: this.network,
      unsoldMintingOptions: UnsoldMintingOptions.KEEP_PRICE,
    });
    const collectionMintOrder = await testEnv.wrap(mintCollection)({});
    await requestFundsFromFaucet(
      this.network,
      this.guardianAddress!.bech32,
      10 * MIN_IOTA_AMOUNT,
      expiresAt,
    );
    await this.walletService!.send(
      this.guardianAddress!,
      collectionMintOrder.payload.targetAddress,
      collectionMintOrder.payload.amount,
      {},
    );
    await MnemonicService.store(this.guardianAddress!.bech32, this.guardianAddress!.mnemonic);

    const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${this.collection}`);
    await wait(async () => {
      const data = <Collection>await collectionDocRef.get();
      return data.status === CollectionStatus.MINTED;
    });

    const collectionData = <Collection>await collectionDocRef.get();
    expect(collectionData.mintingData?.network).toBe(this.network);
    expect(collectionData.mintingData?.mintedBy).toBe(this.guardian);
    expect(collectionData.mintingData?.mintingOrderId).toBe(collectionMintOrder.uid);
    expect(collectionData.mintingData?.address).toBe(collectionMintOrder.payload.targetAddress);
    expect(collectionData.mintingData?.nftsToMint).toBe(0);

    const ownerChangeTran = (
      await build5Db()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.MINT_COLLECTION)
        .where('payload.type', '==', TransactionMintCollectionType.SEND_ALIAS_TO_GUARDIAN)
        .where('member', '==', this.guardian)
        .get()
    ).map((d) => <Transaction>d);

    expect(ownerChangeTran.length).toBe(1);
    expect(ownerChangeTran[0].payload?.walletReference?.confirmed).toBe(true);
  };

  public sendNftToAddress = async (
    sourceAddress: AddressDetails,
    targetAddressBech32: string,
    expiresOn?: Timestamp,
    nftId?: string,
    extraAmount = 0,
    tag = '',
    storageDeposit = false,
  ) => {
    await requestFundsFromFaucet(
      this.network,
      sourceAddress.bech32,
      Math.max(extraAmount, MIN_IOTA_AMOUNT),
    );

    const nftWallet = new NftWallet(this.walletService!);
    const outputs = await this.walletService!.getOutputs(sourceAddress.bech32, [], false);
    const total = Number(mergeOutputs(Object.values(outputs)).amount);

    const [nftOutputId, consumedNftOutput] = Object.entries(
      await nftWallet.getNftOutputs(nftId, sourceAddress.bech32),
    )[0];

    const nftOutput = cloneDeep(consumedNftOutput);
    const targetAddress = Bech32Helper.addressFromBech32(
      targetAddressBech32,
      this.walletService!.info.protocol.bech32Hrp,
    );
    nftOutput.unlockConditions = [{ type: ADDRESS_UNLOCK_CONDITION_TYPE, address: targetAddress }];
    if (tag) {
      nftOutput.features = nftOutput.features || [];
      nftOutput.features.push({ type: TAG_FEATURE_TYPE, tag: Converter.utf8ToHex(tag, true) });
    }
    if (expiresOn) {
      nftOutput.unlockConditions.push({
        type: EXPIRATION_UNLOCK_CONDITION_TYPE,
        returnAddress: Bech32Helper.addressFromBech32(
          sourceAddress.bech32,
          this.walletService!.info.protocol.bech32Hrp,
        ),
        unixTime: dayjs(expiresOn.toDate()).unix(),
      });
    }
    if (storageDeposit) {
      nftOutput.unlockConditions.push({
        type: STORAGE_DEPOSIT_RETURN_UNLOCK_CONDITION_TYPE,
        returnAddress: Bech32Helper.addressFromBech32(
          sourceAddress.bech32,
          this.walletService!.info.protocol.bech32Hrp,
        ),
        amount: nftOutput.amount,
      });
    }
    const consumedExtraAmount = extraAmount || expiresOn ? extraAmount || MIN_IOTA_AMOUNT : 0;
    nftOutput.amount = (Number(nftOutput.amount) + consumedExtraAmount).toString();
    if (nftOutput.nftId === EMPTY_NFT_ID) {
      nftOutput.nftId = TransactionHelper.resolveIdFromOutputId(nftOutputId);
    }

    const remainderAmount = total - consumedExtraAmount;
    const remainder = packBasicOutput(
      sourceAddress.bech32,
      remainderAmount,
      [],
      this.walletService!.info,
    );

    const inputs = [...Object.keys(outputs), nftOutputId].map(TransactionHelper.inputFromOutputId);
    const inputsCommitment = TransactionHelper.getInputsCommitment([
      ...Object.values(outputs),
      consumedNftOutput,
    ]);
    const essence = packEssence(
      inputs,
      inputsCommitment,
      remainderAmount ? [nftOutput, remainder] : [nftOutput],
      this.walletService!,
      {},
    );
    const refUnlocks = Object.keys(outputs).map(
      () =>
        ({
          type: REFERENCE_UNLOCK_TYPE,
          reference: 0,
        } as UnlockTypes),
    );
    return await submitBlock(
      this.walletService!,
      packPayload(essence, [createUnlock(essence, sourceAddress.keyPair), ...refUnlocks]),
    );
  };

  public withdrawNftAndAwait = async (nft: string) => {
    mockWalletReturnValue(this.walletSpy, this.guardian!, { nft });
    await testEnv.wrap(withdrawNft)({});
    await wait(async () => {
      const snap = await build5Db()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.WITHDRAW_NFT)
        .where('payload.nft', '==', nft)
        .get<Transaction>();
      return snap[0]?.payload?.walletReference?.confirmed;
    });
  };

  public setAvailableForAuction = async () => {
    mockWalletReturnValue(this.walletSpy, this.guardian!, this.dummyAuctionData(this.nft!.uid));
    await testEnv.wrap(setForSaleNft)({});
    await wait(
      async () => (await build5Db().doc(`${COL.NFT}/${this.nft!.uid}`).get<Nft>())?.available === 3,
    );
  };

  public setAvailableForSale = async () => {
    mockWalletReturnValue(this.walletSpy, this.guardian!, this.dummySaleData(this.nft!.uid));
    await testEnv.wrap(setForSaleNft)({});
    await wait(
      async () => (await build5Db().doc(`${COL.NFT}/${this.nft!.uid}`).get<Nft>())?.available === 1,
    );
  };

  public createDummyCollection = (space: string, royaltiesSpace: string) => ({
    name: 'Collection A',
    description: 'babba',
    type: CollectionType.CLASSIC,
    royaltiesFee: 0.45,
    category: Categories.ART,
    access: Access.OPEN,
    space,
    royaltiesSpace,
    onePerMemberOnly: false,
    availableFrom: dayjs().add(1, 'hour').toDate(),
    price: 10 * 1000 * 1000,
    bannerUrl: MEDIA,
  });

  public createDummyNft = (collection: string, description = 'babba') => ({
    name: 'NFT ' + description,
    description,
    collection,
    availableFrom: dayjs().add(1, 'hour').toDate(),
    price: 10 * 1000 * 1000,
    uid: getRandomEthAddress(),
    media: MEDIA,
    properties: {
      custom: {
        label: 'custom',
        value: 1,
      },
    },
    stats: {
      customStat: {
        label: 'customStat',
        value: 'customStat',
      },
    },
  });

  public dummyAuctionData = (uid: string) => ({
    nft: uid,
    price: MIN_IOTA_AMOUNT,
    availableFrom: dayjs().toDate(),
    auctionFrom: dayjs().toDate(),
    auctionFloorPrice: MIN_IOTA_AMOUNT,
    auctionLength: 60000 * 4,
    access: NftAccess.OPEN,
  });

  public dummySaleData = (uid: string) => ({
    nft: uid,
    price: MIN_IOTA_AMOUNT,
    availableFrom: dayjs().toDate(),
    access: NftAccess.OPEN,
  });
}
