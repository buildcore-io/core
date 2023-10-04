import { GetNftMutableData, WenError } from '@build-5/interfaces';
import { INftOutput, IndexerPluginClient } from '@iota/iota.js';
import Joi from 'joi';
import { of } from 'rxjs';
import { CommonJoi, getQueryParams } from '../common';
import { AVAILABLE_NETWORKS, getClient, getMutableMetadata } from './wallet';

const getNftMutableDataSchema = Joi.object({
  network: Joi.string().valid(...AVAILABLE_NETWORKS),
  nftId: CommonJoi.uid(),
});

export const getNftMutableMetadata = async (url: string) => {
  const body = getQueryParams<GetNftMutableData>(url, getNftMutableDataSchema);
  try {
    const client = await getClient(body.network);
    const indexer = new IndexerPluginClient(client);
    const outputId = (await indexer.nft(body.nftId)).items[0];
    const output = (await client.output(outputId)).output as INftOutput;
    return of(getMutableMetadata(output));
  } catch {
    throw { code: 400, message: WenError.invalid_nft_id.key };
  }
};
