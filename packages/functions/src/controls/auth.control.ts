import { TOKEN_EXPIRY_HOURS, WenRequest, WEN_FUNC } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import jwt from 'jsonwebtoken';
import { getJwtSecretKey } from '../utils/config.utils';
import { appCheck } from '../utils/google.utils';
import { decodeAuth } from '../utils/wallet.utils';

export const generateCustomFirebaseToken = functions.https.onCall(
  async (req: WenRequest, context) => {
    appCheck(WEN_FUNC.generateCustomFirebaseToken, context);
    const params = await decodeAuth(req, WEN_FUNC.generateCustomFirebaseToken);
    const owner = params.address.toLowerCase();
    const rawJwt = {
      uid: owner,
      iat: dayjs().unix(),
      exp: dayjs().add(TOKEN_EXPIRY_HOURS, 'h').unix(),
    };
    return jwt.sign(rawJwt, getJwtSecretKey());
  },
);
