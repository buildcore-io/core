import { CustomTokenRequest } from '@buildcore/interfaces';
import Joi from 'joi';

export const customTokenSchema = Joi.object<CustomTokenRequest>({})
  .description('Request object to create a custom login token. No params required.')
  .meta({ className: 'CustomTokenRequest' });
