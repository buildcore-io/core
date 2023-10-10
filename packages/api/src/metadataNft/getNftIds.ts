import { GetNftIds, WenError } from '@build-5/interfaces';
import { NftOutput, Utils } from '@iota/sdk';
import Joi from 'joi';
import { of } from 'rxjs';
import { CommonJoi, getQueryParams } from '../common';
import { AVAILABLE_NETWORKS, EMPTY_NFT_ID, getClient } from './wallet';

const getNftIdsSchema = Joi.object({
  network: Joi.string().valid(...AVAILABLE_NETWORKS),
  collectionId: CommonJoi.uid(),
});

export const getNftIds = async (url: string) => {
  const body = getQueryParams<GetNftIds>(url, getNftIdsSchema);
  try {
    const client = await getClient(body.network);

    const collectionOutputId = await client.nftOutputId(body.collectionId);
    const { nftId: collectionId } = (await client.getOutput(collectionOutputId))
      .output as NftOutput;
    const issuerAddress = Utils.nftIdToBech32(
      collectionId,
      (await client.getInfo()).nodeInfo.protocol.bech32Hrp,
    );

    const nftOutputIds = (await client.nftOutputIds([{ issuer: issuerAddress }])).items;
    const promises = nftOutputIds.map(async (outputId) => {
      const output = (await client.getOutput(outputId)).output as NftOutput;
      if (output.nftId === EMPTY_NFT_ID) {
        return Utils.computeNftId(outputId);
      }
      return output.nftId;
    });
    return of(await Promise.all(promises));
  } catch (error) {
    throw { code: 400, message: WenError.invalid_collection_id.key };
  }
};
