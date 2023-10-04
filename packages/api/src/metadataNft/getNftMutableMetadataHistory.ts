import { GetNftMutableMetadatHistory, Network, WenError } from '@build-5/interfaces';
import {
  INftOutput,
  IOutputResponse,
  ITransactionPayload,
  IndexerPluginClient,
  NFT_OUTPUT_TYPE,
  SingleNodeClient,
  TransactionHelper,
} from '@iota/iota.js';
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
    const indexer = new IndexerPluginClient(client);
    const outputId = (await indexer.nft(body.nftId)).items[0];
    let outputResponse: IOutputResponse | undefined = await client.output(outputId);
    do {
      const metadata = getMutableMetadata(outputResponse.output as INftOutput);
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

const getPrevNftOutput = async (client: SingleNodeClient, output: IOutputResponse) => {
  if ((output.output as INftOutput).nftId === EMPTY_NFT_ID) {
    return undefined;
  }
  const block = await client.block(output.metadata.blockId);
  const inputs = (block.payload as ITransactionPayload).essence.inputs;
  const prevOutputIds = inputs.map(({ transactionId, transactionOutputIndex }) =>
    TransactionHelper.outputIdFromTransactionData(transactionId, transactionOutputIndex),
  );
  for (const prevOutputId of prevOutputIds) {
    const prevOutputResponse = await client.output(prevOutputId);
    const prevOutput = prevOutputResponse.output;
    if (prevOutput.type !== NFT_OUTPUT_TYPE) {
      continue;
    }
    const prevNftId = getNftId(prevOutputId, prevOutput);
    if (prevNftId === (output.output as INftOutput).nftId) {
      return prevOutputResponse;
    }
  }

  return undefined;
};

const getNftId = (outputId: string, output: INftOutput) => {
  if (output.nftId === EMPTY_NFT_ID) {
    return TransactionHelper.resolveIdFromOutputId(outputId);
  }
  return output.nftId;
};
