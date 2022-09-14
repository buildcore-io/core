import { AddressTypes, ADDRESS_UNLOCK_CONDITION_TYPE, ED25519_ADDRESS_TYPE, IMetadataFeature, INftOutput, INodeInfo, ISSUER_FEATURE_TYPE, METADATA_FEATURE_TYPE, NFT_OUTPUT_TYPE, TransactionHelper } from "@iota/iota.js-next"
import { Converter } from "@iota/util.js-next"
import { Collection } from "../../../interfaces/models"
import { Nft } from "../../../interfaces/models/nft"
import { AddressDetails } from "../../services/wallet/wallet"

export const EMPTY_NFT_ID = "0x0000000000000000000000000000000000000000000000000000000000000000";

export const createNftOutput = (ownerAddress: AddressDetails, issuerAddress: AddressTypes | undefined, metadata: string, info: INodeInfo): INftOutput => {
  const address: AddressTypes = { type: ED25519_ADDRESS_TYPE, pubKeyHash: ownerAddress.hex }
  const output: INftOutput = {
    type: NFT_OUTPUT_TYPE,
    amount: '0',
    nftId: EMPTY_NFT_ID,
    immutableFeatures: [
      { type: ISSUER_FEATURE_TYPE, address: issuerAddress || address },
      { type: METADATA_FEATURE_TYPE, data: Converter.utf8ToHex(metadata, true) }
    ],
    unlockConditions: [{ type: ADDRESS_UNLOCK_CONDITION_TYPE, address }]
  }
  output.amount = TransactionHelper.getStorageDeposit(output, info.protocol.rentStructure).toString()
  return output
}

export const getNftMetadata = (nft: INftOutput | undefined) => {
  const hexMetadata = <IMetadataFeature | undefined>nft?.immutableFeatures?.find(f => f.type === METADATA_FEATURE_TYPE)
  if (!hexMetadata?.data) {
    return {};
  }
  return JSON.parse(Converter.hexToUtf8(hexMetadata.data) || '{}')
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
