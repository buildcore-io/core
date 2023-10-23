import { CustomTokenRequest } from '@build-5/interfaces';
import Joi from 'joi';

export const customTokenSchema = Joi.object<CustomTokenRequest>({})
  .description('Request object to create a custom login token. No params required.')
  .meta({ className: 'CustomTokenRequest' });
