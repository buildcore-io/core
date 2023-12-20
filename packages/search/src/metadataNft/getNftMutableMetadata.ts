import { GetNftMutableData, WenError } from '@build-5/interfaces';
import { NftOutput } from '@iota/sdk';
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
    const outputId = await client.nftOutputId(body.nftId);
    const output = (await client.getOutput(outputId)).output as NftOutput;
    return of(getMutableMetadata(output));
  } catch {
    throw { code: 400, message: WenError.invalid_nft_id.key };
  }
};
