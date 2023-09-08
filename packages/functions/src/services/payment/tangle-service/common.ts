import { TangleRequestType } from '@build-5/interfaces';
import Joi from 'joi';

export const baseTangleSchema = {
  requestType: Joi.string()
    .valid(...Object.values(TangleRequestType))
    .required()
    .description('Type of the tangle request.'),
};
