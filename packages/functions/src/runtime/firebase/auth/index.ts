import { WEN_FUNC } from '@soonaverse/interfaces';
import Joi from 'joi';
import { generateCustomFirebaseTokenControl } from '../../../controls/auth.control';
import { onRequest } from '../../../firebase/functions/onRequest';

export const generateCustomFirebaseToken = onRequest(
  WEN_FUNC.generateCustomFirebaseToken,
  undefined,
  {
    allowUnknown: true,
  },
)(Joi.object({}), generateCustomFirebaseTokenControl);
