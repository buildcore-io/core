import { WEN_FUNC } from '@soonaverse/interfaces';
import Joi from 'joi';
import { validateAddressControl } from '../../../controls/address.control';
import { onCall } from '../../../firebase/functions/onCall';
import { CommonJoi } from '../../../services/joi/common';
import { networks } from '../../../utils/config.utils';

export const validateAddressSchema = Joi.object({
  space: CommonJoi.uid(false).optional(),
  network: Joi.string()
    .equal(...networks)
    .optional(),
});

export const validateAddress = onCall(WEN_FUNC.validateAddress)(
  validateAddressSchema,
  validateAddressControl,
);
