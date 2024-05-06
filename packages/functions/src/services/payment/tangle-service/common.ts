import { TangleRequestType } from '@buildcore/interfaces';
import Joi from 'joi';

export const baseTangleSchema = (...requestType: TangleRequestType[]) => ({
  requestType: Joi.string()
    .valid(...requestType)
    .required()
    .description('Type of the tangle request.'),
});
