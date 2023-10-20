import Joi from 'joi';

export const customTokenSchema = Joi.object({})
  .description('Request object to create a custom login token. No params required.')
  .meta({ className: 'CustomTokenRequest' });
