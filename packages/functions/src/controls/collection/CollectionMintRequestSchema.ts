import {
  CollectionMintRequest,
  MAX_IOTA_AMOUNT,
  MIN_IOTA_AMOUNT,
  UnsoldMintingOptions,
} from '@build-5/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../services/joi/common';
import { networks } from '../../utils/config.utils';
import { AVAILABLE_NETWORKS } from '../common';

const availaibleNetworks = AVAILABLE_NETWORKS.filter((n) => networks.includes(n));
export const mintCollectionSchema = toJoiObject<CollectionMintRequest>({
  collection: CommonJoi.uid().description('Build5 id of the collection to mint.'),
  network: Joi.string()
    .equal(...availaibleNetworks)
    .required()
    .description('Network to use for minting the collection.'),
  unsoldMintingOptions: Joi.string()
    .equal(...Object.values(UnsoldMintingOptions))
    .required()
    .description('Specifies what should happen with unsold NFTs in this collection.'),
  price: Joi.number()
    .when('unsoldMintingOptions', {
      is: Joi.exist().valid(UnsoldMintingOptions.SET_NEW_PRICE),
      then: Joi.number().min(MIN_IOTA_AMOUNT).max(MAX_IOTA_AMOUNT).integer().required(),
    })
    .description(
      `Price in case unsold minting option is set to new price. Minimum ${MIN_IOTA_AMOUNT}, maximum ${MAX_IOTA_AMOUNT}`,
    ),
})
  .description('Request object to create a collection mint order.')
  .meta({
    className: 'CollectionMintRequest',
  });
