import { WEN_FUNC } from '@soonaverse/interfaces';
import Joi from 'joi';
import { creditUnrefundableControl } from '../../../controls/credit/credit.controller';
import { onCall } from '../../../firebase/functions/onCall';
import { scale } from '../../../scale.settings';
import { CommonJoi } from '../../../services/joi/common';

const SCHEMA = Joi.object({ transaction: CommonJoi.uid() });

export const creditUnrefundable = onCall({
  minInstances: scale(WEN_FUNC.creditUnrefundable),
})(WEN_FUNC.creditUnrefundable, SCHEMA, creditUnrefundableControl);
