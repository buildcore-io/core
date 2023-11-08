import { build5Db, getSnapshot } from '@build-5/database';
import {
  COL,
  Collection,
  CollectionMintRequest,
  CollectionStatus,
  CollectionType,
  Member,
  Network,
  Nft,
  Space,
  TRANSACTION_AUTO_EXPIRY_MS,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  UnsoldMintingOptions,
  WenError,
} from '@build-5/interfaces';
import { Ed25519Address } from '@iota/sdk';
import dayjs from 'dayjs';
import { last } from 'lodash';
import { Wallet } from '../../services/wallet/wallet';
import { AddressDetails, WalletService } from '../../services/wallet/wallet.service';
import { assertMemberHasValidAddress, assertSpaceHasValidAddress } from '../../utils/address.utils';
import {
  EMPTY_NFT_ID,
  collectionToMetadata,
  createNftOutput,
  nftToMetadata,
} from '../../utils/collection-minting-utils/nft.utils';
import { isProdEnv } from '../../utils/config.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';
import { createAliasOutput } from '../../utils/token-minting-utils/alias.utils';
import { assertIsGuardian } from '../../utils/token.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { Context } from '../common';

export const mintCollectionOrderControl = async ({
  project,
  owner,
  params,
}: Context<CollectionMintRequest>) => {
  const network = params.network as Network;

  const member = await build5Db().doc(`${COL.MEMBER}/${owner}`).get<Member>();
  assertMemberHasValidAddress(member, network);

  return await build5Db().runTransaction(async (transaction) => {
    const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${params.collection}`);
    const collection = await transaction.get<Collection>(collectionDocRef);

    if (!collection) {
      throw invalidArgument(WenError.collection_does_not_exists);
    }

    if (isProdEnv() && !collection.approved) {
      throw invalidArgument(WenError.collection_must_be_approved);
    }

    if (collection.status !== CollectionStatus.PRE_MINTED) {
      throw invalidArgument(WenError.invalid_collection_status);
    }

    if (
      params.unsoldMintingOptions === UnsoldMintingOptions.SET_NEW_PRICE &&
      ![CollectionType.GENERATED, CollectionType.SFT].includes(collection.type)
    ) {
      throw invalidArgument(WenError.invalid_collection_status);
    }

    if (
      params.unsoldMintingOptions === UnsoldMintingOptions.TAKE_OWNERSHIP &&
      collection.type !== CollectionType.CLASSIC
    ) {
      throw invalidArgument(WenError.invalid_collection_status);
    }

    assertIsGuardian(collection.space, owner);

    const space = await build5Db().doc(`${COL.SPACE}/${collection.space}`).get<Space>();
    assertSpaceHasValidAddress(space, network);

    const royaltySpace = await build5Db()
      .doc(`${COL.SPACE}/${collection.royaltiesSpace}`)
      .get<Space>();
    assertSpaceHasValidAddress(royaltySpace, network);

    const wallet = await WalletService.newWallet(network);
    const targetAddress = await wallet.getNewIotaAddressDetails();

    const { storageDeposit: nftsStorageDeposit, nftsToMint } = await getNftsTotalStorageDeposit(
      wallet,
      collection,
      params.unsoldMintingOptions as UnsoldMintingOptions,
      targetAddress,
    );
    if (!nftsStorageDeposit) {
      throw invalidArgument(WenError.no_nfts_to_mint);
    }
    const collectionStorageDeposit = await getCollectionStorageDeposit(
      wallet,
      targetAddress,
      collection,
    );
    const aliasOutput = await createAliasOutput(wallet, targetAddress);
    const aliasStorageDeposit = Number(aliasOutput.amount);

    const order: Transaction = {
      project,
      type: TransactionType.ORDER,
      uid: getRandomEthAddress(),
      member: owner,
      space: collection.space,
      network,
      payload: {
        type: TransactionPayloadType.MINT_COLLECTION,
        amount: collectionStorageDeposit + nftsStorageDeposit + aliasStorageDeposit,
        targetAddress: targetAddress.bech32,
        validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
        expiresOn: dateToTimestamp(dayjs().add(TRANSACTION_AUTO_EXPIRY_MS)),
        reconciled: false,
        void: false,
        collection: collection.uid,
        unsoldMintingOptions: params.unsoldMintingOptions as UnsoldMintingOptions,
        newPrice: Number(params.price || 0),
        collectionStorageDeposit,
        nftsStorageDeposit,
        aliasStorageDeposit,
        nftsToMint,
      },
    };
    const orderDocRef = build5Db().doc(`${COL.TRANSACTION}/${order.uid}`);
    transaction.create(orderDocRef, order);
    return order;
  });
};

const getNftsTotalStorageDeposit = async (
  wallet: Wallet,
  collection: Collection,
  unsoldMintingOptions: UnsoldMintingOptions,
  address: AddressDetails,
) => {
  let storageDeposit = 0;
  let nftsToMint = 0;
  let lastUid = '';
  do {
    const lastDoc = await getSnapshot(COL.NFT, lastUid);
    const nfts = await build5Db()
      .collection(COL.NFT)
      .where('collection', '==', collection.uid)
      .where('placeholderNft', '==', false)
      .limit(500)
      .startAfter(lastDoc)
      .get<Nft>();
    lastUid = last(nfts)?.uid || '';

    const promises = nfts.map(async (nft) => {
      if (unsoldMintingOptions === UnsoldMintingOptions.BURN_UNSOLD && !nft.sold) {
        return 0;
      }
      const ownerAddress = new Ed25519Address(address.hex);
      const metadata = JSON.stringify(
        await nftToMetadata(nft, collection, address.bech32, EMPTY_NFT_ID),
      );
      const output = await createNftOutput(wallet, ownerAddress, ownerAddress, metadata);
      return Number(output.amount);
    });
    const amounts = await Promise.all(promises);
    storageDeposit += amounts.reduce((acc, act) => acc + act, 0);
    nftsToMint += amounts.filter((a) => a !== 0).length;
  } while (lastUid);

  return { storageDeposit, nftsToMint };
};

const getCollectionStorageDeposit = async (
  wallet: Wallet,
  address: AddressDetails,
  collection: Collection,
) => {
  const ownerAddress = new Ed25519Address(address.hex);
  const metadata = await collectionToMetadata(collection, address.bech32);
  const output = await createNftOutput(
    wallet,
    ownerAddress,
    ownerAddress,
    JSON.stringify(metadata),
  );
  return Number(output.amount);
};
