import { AddressValidationTangleRequest, TangleRequestType } from '@build-5/interfaces';
import { CommonJoi, toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const validateAddressSchemaObject = toJoiObject<AddressValidationTangleRequest>({
  ...baseTangleSchema(TangleRequestType.ADDRESS_VALIDATION),
  space: CommonJoi.uid(false).optional().description('Build5 id of the space'),
})
  .description('Tangle request object to validate an address.')
  .meta({ className: 'AddressValidationTangleRequest' });
