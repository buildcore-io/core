import { MAX_IOTA_AMOUNT, UnsoldMintingOptions, WEN_FUNC } from '@soonaverse/interfaces';
import Joi from 'joi';
import { mintCollectionOrderControl } from '../../../controls/collection/collection-mint.control';
import { AVAILABLE_NETWORKS } from '../../../controls/common';
import { onCall } from '../../../firebase/functions/onCall';
import { scale } from '../../../scale.settings';
import { CommonJoi } from '../../../services/joi/common';
import { networks } from '../../../utils/config.utils';

const availaibleNetworks = AVAILABLE_NETWORKS.filter((n) => networks.includes(n));
const mintCollectionSchema = Joi.object({
  collection: CommonJoi.uid(),
  network: Joi.string()
    .equal(...availaibleNetworks)
    .required(),
  unsoldMintingOptions: Joi.string()
    .equal(...Object.values(UnsoldMintingOptions))
    .required(),
  price: Joi.when('unsoldMintingOptions', {
    is: Joi.exist().valid(UnsoldMintingOptions.SET_NEW_PRICE),
    then: Joi.number().min(0.001).max(MAX_IOTA_AMOUNT).precision(3).required(),
  }),
});

export const mintCollection = onCall({
  minInstances: scale(WEN_FUNC.mintCollection),
  memory: '8GB',
  timeoutSeconds: 540,
})(WEN_FUNC.creditUnrefundable, mintCollectionSchema, mintCollectionOrderControl);
