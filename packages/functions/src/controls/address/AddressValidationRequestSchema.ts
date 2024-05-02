import { AddressValidationRequest } from '@buildcore/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../services/joi/common';
import { networks } from '../../utils/config.utils';

export const validateAddressSchema = {
  space: CommonJoi.uid(false).optional().description('Buildcore id of the space'),
  network: Joi.string()
    .equal(...networks)
    .optional()
    .description('Network to use for the address'),
};

export const validateAddressSchemaObject = toJoiObject<AddressValidationRequest>(
  validateAddressSchema,
)
  .description('Request object to create an address validation order')
  .meta({ className: 'AddressValidationRequest' });
