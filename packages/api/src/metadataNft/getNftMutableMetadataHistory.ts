import { GetNftMutableMetadatHistory, Network, WenError } from '@build-5/interfaces';
import {
  Client,
  NftOutput,
  OutputResponse,
  OutputType,
  RegularTransactionEssence,
  TransactionPayload,
  UTXOInput,
  Utils,
} from '@iota/sdk';
import Joi from 'joi';
import { isEqual, last } from 'lodash';
import { of } from 'rxjs';
import { CommonJoi, getQueryParams } from '../common';
import { EMPTY_NFT_ID, getClient, getMutableMetadata } from './wallet';

const getNftMutableMetadataHistorySchema = Joi.object({
  network: Joi.string().valid(Network.SMR, Network.RMS),
  nftId: CommonJoi.uid(),
});

export const getNftMutableMetadataHistory = async (url: string) => {
  const body = getQueryParams<GetNftMutableMetadatHistory>(url, getNftMutableMetadataHistorySchema);
  const history: any[] = [];
  try {
    const client = await getClient(body.network);
    const outputId = await client.nftOutputId(body.nftId);
    let outputResponse: OutputResponse | undefined = await client.getOutput(outputId);
    do {
      const metadata = getMutableMetadata(outputResponse.output as NftOutput);
      if (!isEqual(metadata, last(history))) {
        history.push(metadata);
      }
      outputResponse = await getPrevNftOutput(client, outputResponse);
    } while (outputResponse !== undefined);

    history.reverse();
    const response = history.reduce((acc, act, i) => ({ ...acc, [i]: act }), {});
    return of(response);
  } catch {
    throw { code: 400, message: WenError.invalid_nft_id.key };
  }
};

const getPrevNftOutput = async (client: Client, output: OutputResponse) => {
  if ((output.output as NftOutput).nftId === EMPTY_NFT_ID) {
    return undefined;
  }
  const block = await client.getBlock(output.metadata.blockId);
  const essence = (block.payload as TransactionPayload).essence as RegularTransactionEssence;
  const prevOutputIds = essence.inputs.map((i) => {
    const { transactionId, transactionOutputIndex } = i as UTXOInput;
    return Utils.computeOutputId(transactionId, transactionOutputIndex);
  });
  for (const prevOutputId of prevOutputIds) {
    const prevOutputResponse = await client.getOutput(prevOutputId);
    const prevOutput = prevOutputResponse.output;
    if (prevOutput.type !== OutputType.Nft) {
      continue;
    }
    const prevNftId = getNftId(prevOutputId, prevOutput as NftOutput);
    if (prevNftId === (output.output as NftOutput).nftId) {
      return prevOutputResponse;
    }
  }

  return undefined;
};

const getNftId = (outputId: string, output: NftOutput) => {
  if (output.nftId === EMPTY_NFT_ID) {
    return Utils.computeNftId(outputId);
  }
  return output.nftId;
};
