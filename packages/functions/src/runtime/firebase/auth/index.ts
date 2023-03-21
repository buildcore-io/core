import { WEN_FUNC } from '@soonaverse/interfaces';
import Joi from 'joi';
import { generateCustomFirebaseTokenControl } from '../../../controls/auth.control';
import { onCall } from '../../../firebase/functions/onCall';

export const generateCustomFirebaseToken = onCall(WEN_FUNC.generateCustomFirebaseToken, undefined, {
  allowUnknown: true,
})(Joi.object({}), generateCustomFirebaseTokenControl);
