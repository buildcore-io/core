/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  IMetadataFeature,
  INftOutput,
  ITransactionPayload,
  METADATA_FEATURE_TYPE,
  NFT_OUTPUT_TYPE,
  OutputTypes,
  TransactionHelper,
} from '@iota/iota.js-next';
import { Converter } from '@iota/util.js-next';
import { COL, Network, Nft, NftStatus } from '@soonaverse/interfaces';
import axios from 'axios';
import dayjs from 'dayjs';
import { App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { get, last } from 'lodash';
import zlib from 'zlib';

export const fixMintedNftIds = async (app: App) => {
  const db = getFirestore(app);

  let lastDoc: any | undefined = undefined;

  do {
    let query = db
      .collection(COL.NFT)
      .where('mintingData.mintedOn', '<=', dayjs('2022-10-15').toDate())
      .where('status', '==', NftStatus.WITHDRAWN)
      .limit(500);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);

    const promises = snap.docs.map(async (doc) => {
      try {
        const nft = <Nft>doc.data();
        if (!nft.mintingData?.blockId || get(nft, 'mintingData.nftIdFixed')) {
          return;
        }

        const payload = await getBlockPayload(nft.mintingData?.network!, nft.mintingData?.blockId);

        const outputIndex = getNftOutputIndex(nft.uid, payload.essence.outputs);
        const outputId =
          Converter.bytesToHex(TransactionHelper.getTransactionPayloadHash(payload), true) +
          indexToString(outputIndex);
        const nftId = TransactionHelper.resolveIdFromOutputId(outputId);

        await db
          .doc(`${COL.NFT}/${nft.uid}`)
          .update({ 'mintingData.nftId': nftId, 'mintingData.nftIdFixed': true });
      } catch (error) {
        console.log(doc.id);
        throw error;
      }
    });

    await Promise.all(promises);
  } while (lastDoc);
};

const getNftOutputIndex = (nftId: string, outputs: OutputTypes[]) => {
  for (let i = 0; i < outputs.length; ++i) {
    const output = outputs[i];
    if (output.type !== NFT_OUTPUT_TYPE) {
      continue;
    }
    const metadata = getNftMetadata(output);
    if (
      metadata.uid === nftId ||
      metadata.soonaverseId === nftId ||
      metadata.soonaverse?.uid === nftId
    ) {
      return i;
    }
  }
  throw Error('Could not find output index ' + nftId);
};

const getNftMetadata = (nft: INftOutput | undefined) => {
  try {
    const hexMetadata = <IMetadataFeature | undefined>(
      nft?.immutableFeatures?.find((f) => f.type === METADATA_FEATURE_TYPE)
    );
    if (!hexMetadata?.data) {
      return {};
    }
    return JSON.parse(Converter.hexToUtf8(hexMetadata.data) || '{}');
  } catch {
    return {};
  }
};

const indexToString = (index: number) => {
  const str = index.toString(16);
  return (str.length < 2 ? '0' : '') + str + '00';
};

const getBlockPayload = async (network: Network, blockId: string) => {
  const mainnet = `https://explorer-api.shimmer.network/stardust/block/shimmer/${blockId}`;
  const testnet = `https://explorer-api.shimmer.network/stardust/block/testnet/${blockId}`;
  const response = await axios.get(network === Network.SMR ? mainnet : testnet, {
    headers: {
      'Accept-Encoding': 'gzip',
    },
    responseType: 'arraybuffer',
  });
  const decodedData = zlib.gunzipSync(response.data).toString();
  return JSON.parse(decodedData).block.payload as ITransactionPayload;
};

export const roll = fixMintedNftIds;
