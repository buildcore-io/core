import { WEN_FUNC } from '@soonaverse/interfaces';
import Joi from 'joi';
import { AVAILABLE_NETWORKS } from '../../../controls/common';
import { importMintedTokenControl } from '../../../controls/import-minted-token';
import { onCall } from '../../../firebase/functions/onCall';
import { CommonJoi } from '../../../services/joi/common';
import { networks } from '../../../utils/config.utils';

const availaibleNetworks = AVAILABLE_NETWORKS.filter((n) => networks.includes(n));
const importMintedTokenSchema = Joi.object({
  tokenId: CommonJoi.uid(),
  space: CommonJoi.uid(),
  network: Joi.string()
    .equal(...availaibleNetworks)
    .required(),
});

export const importMintedToken = onCall(WEN_FUNC.importMintedToken)(
  importMintedTokenSchema,
  importMintedTokenControl,
);
