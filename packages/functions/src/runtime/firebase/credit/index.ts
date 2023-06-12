import { WEN_FUNC } from '@build-5/interfaces';
import Joi from 'joi';
import { creditUnrefundableControl } from '../../../controls/credit/credit.controller';
import { onRequest } from '../../../firebase/functions/onRequest';
import { CommonJoi } from '../../../services/joi/common';

const SCHEMA = Joi.object({ transaction: CommonJoi.uid() });

export const creditUnrefundable = onRequest(WEN_FUNC.creditUnrefundable)(
  SCHEMA,
  creditUnrefundableControl,
);
