import {
  IMetadataFeature,
  INftOutput,
  ITransactionPayload,
  METADATA_FEATURE_TYPE,
  NFT_OUTPUT_TYPE,
  OutputTypes,
  SingleNodeClient,
  TransactionHelper,
} from '@iota/iota.js-next';
import { Converter } from '@iota/util.js-next';
import { COL, Nft, NftStatus } from '@soonaverse/interfaces';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { last } from 'lodash';
import serviceAccount from '../../serviceAccountKeyTest.json';

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

export const fixMintedNftIds = async () => {
  const client = new SingleNodeClient('https://smr1.svrs.io/');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lastDoc: any | undefined = undefined;
  do {
    let query = db.collection(COL.NFT).where('status', '==', NftStatus.MINTED).limit(1000);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const docs = (await query.get()).docs;

    const promises = docs.map(async (doc) => {
      const nft = <Nft>doc.data();

      const block = await client.block(nft.mintingData?.blockId!);
      const payload = block.payload as ITransactionPayload;

      const outputIndex = getNftOutputIndex(nft.uid, payload.essence.outputs);
      const outputId =
        Converter.bytesToHex(TransactionHelper.getTransactionPayloadHash(payload), true) +
        indexToString(outputIndex);
      const nftId = TransactionHelper.resolveIdFromOutputId(outputId);
      await db.doc(`${COL.NFT}/${nft.uid}`).update({ 'mintingData.nftId': nftId });
    });

    await Promise.all(promises);
    lastDoc = last(docs);
  } while (lastDoc !== undefined);
};

const getNftOutputIndex = (nftId: string, outputs: OutputTypes[]) => {
  for (let i = 0; i < outputs.length; ++i) {
    const output = outputs[i];
    if (output.type !== NFT_OUTPUT_TYPE) {
      continue;
    }
    const metadata = getNftMetadata(output);
    if (metadata.soonaverseId === nftId) {
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

fixMintedNftIds();
