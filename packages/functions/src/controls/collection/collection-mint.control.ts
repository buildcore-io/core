import {
  COL,
  Collection,
  CollectionStatus,
  CollectionType,
  Member,
  Network,
  Nft,
  Space,
  TRANSACTION_AUTO_EXPIRY_MS,
  Transaction,
  TransactionOrderType,
  TransactionType,
  TransactionValidationType,
  UnsoldMintingOptions,
  WenError,
} from '@build5/interfaces';
import { AddressTypes, ED25519_ADDRESS_TYPE, INodeInfo } from '@iota/iota.js-next';
import dayjs from 'dayjs';
import { last } from 'lodash';
import { getSnapshot, soonDb } from '../../firebase/firestore/soondb';
import { SmrWallet } from '../../services/wallet/SmrWalletService';
import { AddressDetails, WalletService } from '../../services/wallet/wallet';
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

export const mintCollectionOrderControl = async (
  owner: string,
  params: Record<string, unknown>,
) => {
  const network = params.network as Network;

  const member = await soonDb().doc(`${COL.MEMBER}/${owner}`).get<Member>();
  assertMemberHasValidAddress(member, network);

  return await soonDb().runTransaction(async (transaction) => {
    const collectionDocRef = soonDb().doc(`${COL.COLLECTION}/${params.collection}`);
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

    const space = await soonDb().doc(`${COL.SPACE}/${collection.space}`).get<Space>();
    assertSpaceHasValidAddress(space, network);

    const royaltySpace = await soonDb()
      .doc(`${COL.SPACE}/${collection.royaltiesSpace}`)
      .get<Space>();
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
      throw invalidArgument(WenError.no_nfts_to_mint);
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
        expiresOn: dateToTimestamp(dayjs().add(TRANSACTION_AUTO_EXPIRY_MS)),
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
    const orderDocRef = soonDb().doc(`${COL.TRANSACTION}/${order.uid}`);
    transaction.create(orderDocRef, order);
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
  let lastUid = '';
  do {
    const lastDoc = await getSnapshot(COL.NFT, lastUid);
    const nfts = await soonDb()
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
  } while (lastUid);

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
