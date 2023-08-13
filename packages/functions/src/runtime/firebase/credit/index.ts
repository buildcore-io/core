import { WEN_FUNC } from '@build-5/interfaces';
import { creditUnrefundableControl } from '../../../controls/credit/credit.controller';
import { onRequest } from '../../../firebase/functions/onRequest';
import { creditUnrefundableSchema } from './CreditUnrefundableRequestSchema';

export const creditUnrefundable = onRequest(WEN_FUNC.creditUnrefundable)(
  creditUnrefundableSchema,
  creditUnrefundableControl,
);
