import { database } from '@buildcore/database';
import {
  COL,
  Collection,
  CollectionMintRequest,
  CollectionStatus,
  CollectionType,
  Network,
  Nft,
  TRANSACTION_AUTO_EXPIRY_MS,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  UnsoldMintingOptions,
  WenError,
} from '@buildcore/interfaces';
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
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';
import { createAliasOutput } from '../../utils/token-minting-utils/alias.utils';
import { assertIsCollectionGuardian } from '../../utils/token.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { Context } from '../common';

export const mintCollectionOrderControl = async ({
  project,
  owner,
  params,
}: Context<CollectionMintRequest>) => {
  const network = params.network as Network;

  const member = await database().doc(COL.MEMBER, owner).get();
  assertMemberHasValidAddress(member, network);

  return await database().runTransaction(async (transaction) => {
    const collectionDocRef = database().doc(COL.COLLECTION, params.collection);
    const collection = await transaction.get(collectionDocRef);

    if (!collection) {
      throw invalidArgument(WenError.collection_does_not_exists);
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

    await assertIsCollectionGuardian(collection, owner);

    const space = await database().doc(COL.SPACE, collection.space!).get();
    assertSpaceHasValidAddress(space, network);

    if (collection.royaltiesSpace) {
      const royaltySpace = await database().doc(COL.SPACE, collection.royaltiesSpace).get();
      assertSpaceHasValidAddress(royaltySpace, network);
    }

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
    const orderDocRef = database().doc(COL.TRANSACTION, order.uid);
    await transaction.create(orderDocRef, order);
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
  let lastDoc: Nft | undefined = undefined;
  do {
    const nfts: Nft[] = await database()
      .collection(COL.NFT)
      .where('collection', '==', collection.uid)
      .where('placeholderNft', '==', false)
      .startAfter(lastDoc)
      .limit(500)
      .get();
    lastDoc = last(nfts);

    const promises = nfts.map(async (nft) => {
      if (unsoldMintingOptions === UnsoldMintingOptions.BURN_UNSOLD && !nft.sold) {
        return 0;
      }
      const ownerAddress = new Ed25519Address(address.hex);
      const nftMetadata = await nftToMetadata(nft, collection, address.bech32, EMPTY_NFT_ID);
      const metadata = JSON.stringify(nftMetadata);
      const output = await createNftOutput(wallet, ownerAddress, ownerAddress, metadata);
      return Number(output.amount);
    });
    const amounts = await Promise.all(promises);
    storageDeposit += amounts.reduce((acc, act) => acc + act, 0);
    nftsToMint += amounts.filter((a) => a !== 0).length;
  } while (lastDoc);

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
