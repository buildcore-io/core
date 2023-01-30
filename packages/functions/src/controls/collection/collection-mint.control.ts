import { AddressTypes, ED25519_ADDRESS_TYPE, INodeInfo } from '@iota/iota.js-next';
import {
  COL,
  Collection,
  CollectionStatus,
  CollectionType,
  Member,
  Network,
  Nft,
  Space,
  Transaction,
  TransactionOrderType,
  TransactionType,
  TransactionValidationType,
  TRANSACTION_AUTO_EXPIRY_MS,
  UnsoldMintingOptions,
  WenError,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { Database, TransactionRunner } from '../../database/Database';
import { SmrWallet } from '../../services/wallet/SmrWalletService';
import { AddressDetails, WalletService } from '../../services/wallet/wallet';
import { assertMemberHasValidAddress, assertSpaceHasValidAddress } from '../../utils/address.utils';
import {
  collectionToMetadata,
  createNftOutput,
  EMPTY_NFT_ID,
  nftToMetadata,
} from '../../utils/collection-minting-utils/nft.utils';
import { isProdEnv } from '../../utils/config.utils';
import { dateToTimestamp, serverTime } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { createAliasOutput } from '../../utils/token-minting-utils/alias.utils';
import { assertIsGuardian } from '../../utils/token.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const mintCollectionOrderControl = async (
  owner: string,
  params: Record<string, unknown>,
) => {
  const network = params.network as Network;

  const member = await Database.getById<Member>(COL.MEMBER, owner);
  assertMemberHasValidAddress(member, network);

  return await TransactionRunner.runTransaction(async (transaction) => {
    const collection = await transaction.getById<Collection>(
      COL.COLLECTION,
      params.collection as string,
    );

    if (!collection) {
      throw throwInvalidArgument(WenError.collection_does_not_exists);
    }

    if (isProdEnv() && !collection.approved) {
      throw throwInvalidArgument(WenError.collection_must_be_approved);
    }

    if (collection.status !== CollectionStatus.PRE_MINTED) {
      throw throwInvalidArgument(WenError.invalid_collection_status);
    }

    if (
      params.unsoldMintingOptions === UnsoldMintingOptions.SET_NEW_PRICE &&
      ![CollectionType.GENERATED, CollectionType.SFT].includes(collection.type)
    ) {
      throw throwInvalidArgument(WenError.invalid_collection_status);
    }

    if (
      params.unsoldMintingOptions === UnsoldMintingOptions.TAKE_OWNERSHIP &&
      collection.type !== CollectionType.CLASSIC
    ) {
      throw throwInvalidArgument(WenError.invalid_collection_status);
    }

    assertIsGuardian(collection.space, owner);

    const space = await Database.getById<Space>(COL.SPACE, collection.space);
    assertSpaceHasValidAddress(space, network);

    const royaltySpace = await Database.getById<Space>(COL.SPACE, collection.royaltiesSpace);
    assertSpaceHasValidAddress(royaltySpace, network);

    const wallet = (await WalletService.newWallet(network)) as SmrWallet;
    const targetAddress = await wallet.getNewIotaAddressDetails();

    const { storageDeposit: nftsStorageDeposit, nftsToMint } = await getNftsTotalStorageDeposit(
      collection,
      params.unsoldMintingOptions as UnsoldMintingOptions,
      targetAddress,
      wallet.info,
    );
    if (!nftsStorageDeposit) {
      throw throwInvalidArgument(WenError.no_nfts_to_mint);
    }
    const collectionStorageDeposit = await getCollectionStorageDeposit(
      targetAddress,
      collection,
      wallet.info,
    );
    const aliasStorageDeposit = Number(createAliasOutput(targetAddress, wallet.info).amount);

    const order = <Transaction>{
      type: TransactionType.ORDER,
      uid: getRandomEthAddress(),
      member: owner,
      space: collection.space,
      network,
      payload: {
        type: TransactionOrderType.MINT_COLLECTION,
        amount: collectionStorageDeposit + nftsStorageDeposit + aliasStorageDeposit,
        targetAddress: targetAddress.bech32,
        validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
        expiresOn: dateToTimestamp(
          dayjs(serverTime().toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms'),
        ),
        reconciled: false,
        void: false,
        collection: collection.uid,
        unsoldMintingOptions: params.unsoldMintingOptions,
        newPrice: Number(params.price || 0),
        collectionStorageDeposit,
        nftsStorageDeposit,
        aliasStorageDeposit,
        nftsToMint,
      },
    };

    transaction.update({ col: COL.TRANSACTION, data: order, action: 'set' });
    return order;
  });
};

const getNftsTotalStorageDeposit = async (
  collection: Collection,
  unsoldMintingOptions: UnsoldMintingOptions,
  address: AddressDetails,
  info: INodeInfo,
) => {
  let storageDeposit = 0;
  let nftsToMint = 0;
  await Database.getManyPaginated<Nft>(COL.NFT, {
    collection: collection.uid,
    placeholderNft: false,
  })(async (nfts) => {
    const promises = nfts.map(async (nft) => {
      if (unsoldMintingOptions === UnsoldMintingOptions.BURN_UNSOLD && !nft.sold) {
        return 0;
      }
      const ownerAddress: AddressTypes = { type: ED25519_ADDRESS_TYPE, pubKeyHash: address.hex };
      const metadata = JSON.stringify(
        await nftToMetadata(nft, collection, address.bech32, EMPTY_NFT_ID),
      );
      const output = createNftOutput(ownerAddress, ownerAddress, metadata, info);
      return Number(output.amount);
    });
    const amounts = await Promise.all(promises);
    storageDeposit += amounts.reduce((acc, act) => acc + act, 0);
    nftsToMint += amounts.filter((a) => a !== 0).length;
  });
  return { storageDeposit, nftsToMint };
};

const getCollectionStorageDeposit = async (
  address: AddressDetails,
  collection: Collection,
  info: INodeInfo,
) => {
  const ownerAddress: AddressTypes = { type: ED25519_ADDRESS_TYPE, pubKeyHash: address.hex };
  const metadata = await collectionToMetadata(collection, address.bech32);
  const output = createNftOutput(ownerAddress, ownerAddress, JSON.stringify(metadata), info);
  return Number(output.amount);
};
