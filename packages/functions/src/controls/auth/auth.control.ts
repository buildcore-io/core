import { TOKEN_EXPIRY_HOURS } from '@build-5/interfaces';
import dayjs from 'dayjs';
import jwt from 'jsonwebtoken';
import { getJwtSecretKey } from '../../utils/config.utils';
import { Context } from '../common';

export const generateCustomTokenControl = async ({ owner }: Context) => {
  const rawJwt = {
    uid: owner,
    iat: dayjs().unix(),
    exp: dayjs().add(TOKEN_EXPIRY_HOURS, 'h').unix(),
  };
  return jwt.sign(rawJwt, getJwtSecretKey());
};
