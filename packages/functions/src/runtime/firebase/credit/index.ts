import { CreditUnrefundableRequest, WEN_FUNC } from '@build-5/interfaces';
import { creditUnrefundableControl } from '../../../controls/credit/credit.controller';
import { onRequest } from '../../../firebase/functions/onRequest';
import { CommonJoi, toJoiObject } from '../../../services/joi/common';

const schema = toJoiObject<CreditUnrefundableRequest>({ transaction: CommonJoi.uid() });

export const creditUnrefundable = onRequest(WEN_FUNC.creditUnrefundable)(
  schema,
  creditUnrefundableControl,
);
