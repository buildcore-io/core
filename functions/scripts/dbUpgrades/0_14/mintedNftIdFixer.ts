import { ITransactionPayload, NFT_OUTPUT_TYPE, OutputTypes, TransactionHelper } from '@iota/iota.js-next';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { last } from 'lodash';
import { Network } from '../../../interfaces/models';
import { COL } from "../../../interfaces/models/base";
import { Nft, NftStatus } from '../../../interfaces/models/nft';
import { SmrWallet } from '../../../src/services/wallet/SmrWalletService';
import { WalletService } from '../../../src/services/wallet/wallet';
import { indexToString } from '../../../src/utils/block.utils';
import { getTransactionPayloadHex } from '../../../src/utils/smr.utils';
import { getNftMetadata } from '../../../test-tangle/collection-minting/Helper';
import serviceAccount from '../../serviceAccountKeyTest.json';

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

export const fixMintedNftIds = async () => {
  const wallet = await WalletService.newWallet(Network.SMR) as SmrWallet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lastDoc: any | undefined = undefined
  do {
    let query = db.collection(COL.NFT).where('status', '==', NftStatus.MINTED).limit(1000)
    if (lastDoc) {
      query = query.startAfter(lastDoc)
    }
    const docs = (await query.get()).docs

    const promises = docs.map(async (doc) => {
      const nft = <Nft>doc.data()

      const block = await wallet.client.block(nft.mintingData?.blockId!)
      const payload = block.payload as ITransactionPayload

      const outputIndex = getNftOutputIndex(nft.uid, payload.essence.outputs)
      const outputId = getTransactionPayloadHex(payload) + indexToString(outputIndex)
      const nftId = TransactionHelper.resolveIdFromOutputId(outputId)
      await db.doc(`${COL.NFT}/${nft.uid}`).update({ 'mintingData.nftId': nftId })
    })

    await Promise.all(promises)
    lastDoc = last(docs)
  } while (lastDoc !== undefined)
}

const getNftOutputIndex = (nftId: string, outputs: OutputTypes[]) => {
  for (let i = 0; i < outputs.length; ++i) {
    const output = outputs[i]
    if (output.type !== NFT_OUTPUT_TYPE) {
      continue
    }
    const metadata = getNftMetadata(output)
    if (metadata.soonaverseId === nftId) {
      return i
    }
  }
  throw Error('Could not find output index ' + nftId)
}

fixMintedNftIds();
