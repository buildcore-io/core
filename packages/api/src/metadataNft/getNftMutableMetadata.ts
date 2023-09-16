import { GetNftMutableData, Network, WenError } from '@build-5/interfaces';
import { INftOutput, IndexerPluginClient } from '@iota/iota.js-next';
import Joi from 'joi';
import { of } from 'rxjs';
import { CommonJoi, getQueryParams } from '../common';
import { getMutableMetadata, getShimmerClient } from './wallet';

const getNftMutableDataSchema = Joi.object({
  network: Joi.string().valid(Network.SMR, Network.RMS),
  nftId: CommonJoi.uid(),
});

export const getNftMutableMetadata = async (url: string) => {
  const body = getQueryParams<GetNftMutableData>(url, getNftMutableDataSchema);
  try {
    const client = await getShimmerClient(body.network);
    const indexer = new IndexerPluginClient(client);
    const outputId = (await indexer.nft(body.nftId)).items[0];
    const output = (await client.output(outputId)).output as INftOutput;
    return of(getMutableMetadata(output));
  } catch {
    throw { code: 400, message: WenError.invalid_nft_id.key };
  }
};
