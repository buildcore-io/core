import {
  AddressTypes,
  ADDRESS_UNLOCK_CONDITION_TYPE,
  ED25519_ADDRESS_TYPE,
  INftOutput,
  INodeInfo,
  ISSUER_FEATURE_TYPE,
  METADATA_FEATURE_TYPE,
  NFT_OUTPUT_TYPE,
  TransactionHelper,
} from '@iota/iota.js-next';
import { Converter } from '@iota/util.js-next';
import { Collection, KEY_NAME_TANGLE, Nft } from '@soonaverse/interfaces';
import admin from '../../admin.config';
import { PLACEHOLDER_CID } from '../car.utils';
import { getMediaMetadata } from '../storage.utils';

export const EMPTY_NFT_ID = '0x0000000000000000000000000000000000000000000000000000000000000000';

export const ZERO_ADDRESS: AddressTypes = {
  type: ED25519_ADDRESS_TYPE,
  pubKeyHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
};

export const createNftOutput = (
  ownerAddress: AddressTypes,
  issuerAddress: AddressTypes,
  metadata: string,
  info: INodeInfo,
): INftOutput => {
  const output: INftOutput = {
    type: NFT_OUTPUT_TYPE,
    amount: '0',
    nftId: EMPTY_NFT_ID,
    immutableFeatures: [
      { type: ISSUER_FEATURE_TYPE, address: issuerAddress },
      { type: METADATA_FEATURE_TYPE, data: Converter.utf8ToHex(metadata, true) },
    ],
    unlockConditions: [{ type: ADDRESS_UNLOCK_CONDITION_TYPE, address: ownerAddress }],
  };
  output.amount = TransactionHelper.getStorageDeposit(
    output,
    info.protocol.rentStructure,
  ).toString();
  return output;
};

export const nftToMetadata = async (
  storage: admin.storage.Storage,
  nft: Nft,
  collection: Collection,
  royaltySpaceAddress: string,
  collectionId: string,
) => {
  const mediaMetadata = await getMediaMetadata(storage, nft.media || '');
  return {
    standard: 'IRC27',
    version: 'v1.0',

    type: mediaMetadata.contentType || 'application/octet-stream',

    uri: 'ipfs://' + (nft.ipfsMedia || PLACEHOLDER_CID),
    name: nft.name || '',
    description: nft.description || '',
    issuerName: KEY_NAME_TANGLE,
    collectionId,
    collectionName: collection.name || '',

    attributes: {
      props: nft.properties || {},
      stats: nft.stats || {},
    },

    royalties: {
      [royaltySpaceAddress]: collection.royaltiesFee,
    },

    soonaverseId: nft.uid,
  };
};

export const collectionToMetadata = async (
  storage: admin.storage.Storage,
  collection: Collection,
  royaltySpaceAddress: string,
) => {
  const mediaMetadata = await getMediaMetadata(storage, collection.bannerUrl || '');
  return {
    standard: 'IRC27',
    version: 'v1.0',
    type: mediaMetadata.contentType || 'application/octet-stream',
    uri: 'ipfs://' + (collection.ipfsMedia || PLACEHOLDER_CID),
    name: collection.name,
    description: collection.description || '',
    issuerName: KEY_NAME_TANGLE,
    royalties: {
      [royaltySpaceAddress]: collection.royaltiesFee,
    },
    soonaverseId: collection.uid,
  };
};
