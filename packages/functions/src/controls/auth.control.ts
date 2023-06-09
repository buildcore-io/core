import { TOKEN_EXPIRY_HOURS } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import jwt from 'jsonwebtoken';
import { getJwtSecretKey } from '../utils/config.utils';

export const generateCustomTokenControl = async (owner: string) => {
  const rawJwt = {
    uid: owner,
    iat: dayjs().unix(),
    exp: dayjs().add(TOKEN_EXPIRY_HOURS, 'h').unix(),
  };
  return jwt.sign(rawJwt, getJwtSecretKey());
};
