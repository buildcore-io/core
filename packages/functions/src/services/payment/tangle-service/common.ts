import { TangleRequestType } from '@build-5/interfaces';
import Joi from 'joi';

export const baseTangleSchema = (...requestType: TangleRequestType[]) => ({
  requestType: Joi.string()
    .valid(...requestType)
    .required()
    .description('Type of the tangle request.'),
});
