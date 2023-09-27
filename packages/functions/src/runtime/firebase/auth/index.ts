import { WEN_FUNC } from '@build-5/interfaces';
import { generateCustomTokenControl } from '../../../controls/auth.control';
import { onRequest } from '../common';
import { customTokenSchema } from './CutomTokenRequestSchema';

export const generateCustomToken = onRequest(WEN_FUNC.generateCustomToken, undefined, {
  allowUnknown: true,
})(customTokenSchema, generateCustomTokenControl);
