import { WEN_FUNC } from '@build-5/interfaces';
import Joi from 'joi';
import { validateAddressControl } from '../../../controls/address.control';
import { onRequest } from '../../../firebase/functions/onRequest';
import { CommonJoi } from '../../../services/joi/common';
import { networks } from '../../../utils/config.utils';

export const validateAddressSchema = Joi.object({
  space: CommonJoi.uid(false).optional(),
  network: Joi.string()
    .equal(...networks)
    .optional(),
});

export const validateAddress = onRequest(WEN_FUNC.validateAddress)(
  validateAddressSchema,
  validateAddressControl,
);
