import { AddressValidationTangleRequest, TangleRequestType } from '@build-5/interfaces';
import { validateAddressSchema } from '../../../../runtime/firebase/address/AddressValidationRequestSchema';
import { toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const validateAddressSchemaObject = toJoiObject<AddressValidationTangleRequest>({
  ...baseTangleSchema(TangleRequestType.ADDRESS_VALIDATION),
  ...validateAddressSchema,
})
  .description(
    'Tangle request object to validate an address. ' +
      'If the source address is SMR, the address will be validated, otherswise and address validation order is created.',
  )
  .meta({ className: 'AddressValidationTangleRequest' });
