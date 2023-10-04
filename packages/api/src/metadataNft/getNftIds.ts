import { GetNftIds, Network, WenError } from '@build-5/interfaces';
import {
  Bech32Helper,
  INftOutput,
  IndexerPluginClient,
  NFT_ADDRESS_TYPE,
  TransactionHelper,
} from '@iota/iota.js';
import { Converter, HexHelper } from '@iota/util.js';
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
    const indexer = new IndexerPluginClient(client);

    const collectionOutputId = (await indexer.nft(body.collectionId)).items[0];
    const { nftId: collectionId } = (await client.output(collectionOutputId)).output as INftOutput;
    const issuerAddress = Bech32Helper.toBech32(
      NFT_ADDRESS_TYPE,
      Converter.hexToBytes(HexHelper.stripPrefix(collectionId)),
      body.network || Network.SMR,
    );

    const nftOutputIds = (await indexer.nfts({ issuerBech32: issuerAddress })).items;
    const promises = nftOutputIds.map(async (outputId) => {
      const output = (await client.output(outputId)).output as INftOutput;
      if (output.nftId === EMPTY_NFT_ID) {
        return TransactionHelper.resolveIdFromOutputId(outputId);
      }
      return output.nftId;
    });
    return of(await Promise.all(promises));
  } catch (error) {
    throw { code: 400, message: WenError.invalid_collection_id.key };
  }
};
