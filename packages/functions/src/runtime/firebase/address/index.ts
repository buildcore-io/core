import { WEN_FUNC } from '@build-5/interfaces';
import { validateAddressControl } from '../../../controls/address.control';
import { onRequest } from '../../../firebase/functions/onRequest';
import { validateAddressSchemaObject } from './AddressValidationRequestSchema';

export const validateAddress = onRequest(WEN_FUNC.validateAddress)(
  validateAddressSchemaObject,
  validateAddressControl,
);
