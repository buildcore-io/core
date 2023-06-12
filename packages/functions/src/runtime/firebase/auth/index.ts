import { WEN_FUNC } from '@build5/interfaces';
import Joi from 'joi';
import { generateCustomTokenControl } from '../../../controls/auth.control';
import { onRequest } from '../../../firebase/functions/onRequest';

export const generateCustomToken = onRequest(WEN_FUNC.generateCustomToken, undefined, {
  allowUnknown: true,
})(Joi.object({}), generateCustomTokenControl);
