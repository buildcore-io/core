import { WEN_FUNC } from '@build-5/interfaces';
import { creditUnrefundableControl } from '../../../controls/credit/credit.controller';
import { creditUnrefundableSchema } from './CreditUnrefundableRequestSchema';
import { onRequest } from '../common';

export const creditUnrefundable = onRequest(WEN_FUNC.creditUnrefundable)(
  creditUnrefundableSchema,
  creditUnrefundableControl,
);
