import { build5Db } from '@build-5/database';
import { COL, Collection, KEY_NAME_TANGLE, NetworkAddress, Nft } from '@build-5/interfaces';
import {
  Address,
  AddressUnlockCondition,
  Ed25519Address,
  IssuerFeature,
  MetadataFeature,
  NftOutput,
  NftOutputBuilderParams,
  TimelockUnlockCondition,
  utf8ToHex,
} from '@iota/sdk';
import dayjs from 'dayjs';
import { head } from 'lodash';
import { Wallet } from '../../services/wallet/wallet';
import { PLACEHOLDER_CID } from '../car.utils';
import { getContentType } from '../storage.utils';
import { propsToAttributes } from './nft.prop.utils';

export const EMPTY_NFT_ID = '0x0000000000000000000000000000000000000000000000000000000000000000';

export const ZERO_ADDRESS = new Ed25519Address(
  '0x0000000000000000000000000000000000000000000000000000000000000000',
);

export const createNftOutput = async (
  wallet: Wallet,
  ownerAddress: Address,
  issuerAddress: Address,
  metadata: string,
  vestingAt?: dayjs.Dayjs,
  mutableMetadata?: string,
): Promise<NftOutput> => {
  const params: NftOutputBuilderParams = {
    nftId: EMPTY_NFT_ID,
    immutableFeatures: [new IssuerFeature(issuerAddress)],
    unlockConditions: [new AddressUnlockCondition(ownerAddress)],
  };
  if (metadata) {
    params.immutableFeatures?.push(new MetadataFeature(utf8ToHex(metadata)));
  }
  if (mutableMetadata) {
    params.features = [new MetadataFeature(utf8ToHex(mutableMetadata))];
  }
  if (vestingAt && vestingAt.isAfter(dayjs())) {
    params.unlockConditions.push(new TimelockUnlockCondition(vestingAt.unix()));
  }
  return await wallet.client.buildNftOutput(params);
};

export const nftToMetadata = async (
  nft: Nft,
  collection: Collection,
  royaltySpaceAddress: NetworkAddress,
  collectionId: string,
) => {
  const props = propsToAttributes(nft.properties);
  const stats = propsToAttributes(nft.stats);
  return {
    standard: 'IRC27',
    version: 'v1.0',

    type: await getContentType(nft.media),

    uri: 'ipfs://' + (nft.ipfsMedia || PLACEHOLDER_CID),
    name: nft.name || '',
    description: nft.description || '',
    issuerName: KEY_NAME_TANGLE,
    collectionId,
    collectionName: collection.name || '',

    attributes: [...props, ...stats],

    royalties: collection.royaltiesFee ? { [royaltySpaceAddress]: collection.royaltiesFee } : {},

    build5Id: nft.uid,
  };
};

export const collectionToMetadata = async (
  collection: Collection,
  royaltySpaceAddress: NetworkAddress,
) => {
  return {
    standard: 'IRC27',
    version: 'v1.0',
    type: await getContentType(collection.bannerUrl),
    uri: 'ipfs://' + (collection.ipfsMedia || PLACEHOLDER_CID),
    name: collection.name,
    description: collection.description || '',
    issuerName: KEY_NAME_TANGLE,
    royalties: collection.royaltiesFee ? { [royaltySpaceAddress]: collection.royaltiesFee } : {},
    build5Id: collection.uid,
  };
};

export const getNftByMintingId = async (nftId: string) => {
  const snap = await build5Db().collection(COL.NFT).where('mintingData_nftId', '==', nftId).get();
  return head(snap);
};

export const getCollectionByMintingId = async (collectionId: string) => {
  const snap = await build5Db()
    .collection(COL.COLLECTION)
    .where('mintingData_nftId', '==', collectionId)
    .get();
  return head(snap);
};
