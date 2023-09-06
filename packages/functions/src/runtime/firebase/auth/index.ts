import { WEN_FUNC } from '@build-5/interfaces';
import { generateCustomTokenControl } from '../../../controls/auth.control';
import { customTokenSchema } from './CutomTokenRequestSchema';
import { onRequest } from '../common';

export const generateCustomToken = onRequest(WEN_FUNC.generateCustomToken, undefined, {
  allowUnknown: true,
})(customTokenSchema, generateCustomTokenControl);
