import { AddressTypes, ADDRESS_UNLOCK_CONDITION_TYPE, IMetadataFeature, INftOutput, INodeInfo, ISSUER_FEATURE_TYPE, METADATA_FEATURE_TYPE, NFT_OUTPUT_TYPE, TransactionHelper } from "@iota/iota.js-next"
import { Converter } from "@iota/util.js-next"
import { Collection } from "../../../interfaces/models"
import { Nft } from "../../../interfaces/models/nft"

export const EMPTY_NFT_ID = "0x0000000000000000000000000000000000000000000000000000000000000000";

export const createNftOutput = (ownerAddress: AddressTypes, issuerAddress: AddressTypes, metadata: string, info: INodeInfo): INftOutput => {
  const output: INftOutput = {
    type: NFT_OUTPUT_TYPE,
    amount: '0',
    nftId: EMPTY_NFT_ID,
    immutableFeatures: [
      { type: ISSUER_FEATURE_TYPE, address: issuerAddress },
      { type: METADATA_FEATURE_TYPE, data: Converter.utf8ToHex(metadata, true) }
    ],
    unlockConditions: [{ type: ADDRESS_UNLOCK_CONDITION_TYPE, address: ownerAddress }]
  }
  output.amount = TransactionHelper.getStorageDeposit(output, info.protocol.rentStructure).toString()
  return output
}

export const getNftMetadata = (nft: INftOutput | undefined) => {
  try {
    const hexMetadata = <IMetadataFeature | undefined>nft?.immutableFeatures?.find(f => f.type === METADATA_FEATURE_TYPE)
    if (!hexMetadata?.data) {
      return {};
    }
    return JSON.parse(Converter.hexToUtf8(hexMetadata.data) || '{}')
  } catch {
    return {}
  }
}

export const nftToMetadata = (nft: Nft) => ({
  name: nft.name || '',
  description: nft.description || '',
  ipfsMedia: nft.ipfsMedia || '',
  props: nft.properties || {},
  stats: nft.stats || {},
  uid: nft.uid,
  space: nft.space,
  collection: nft.collection
})

export const collectionToMetadata = (collection: Collection) => ({
  standard: 'IRC27',
  type: collection.type,
  uri: collection.url,
  name: collection.name,
  description: collection.description || '',
  uid: collection.uid,
})
