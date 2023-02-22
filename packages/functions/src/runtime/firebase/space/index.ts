import { WEN_FUNC } from '@soonaverse/interfaces';
import Joi from 'joi';
import { claimSpaceControl } from '../../../controls/space/space.claim.control';
import { onCall } from '../../../firebase/functions/onCall';
import { CommonJoi } from '../../../services/joi/common';

export const claimSpace = onCall(WEN_FUNC.claimSpace)(
  Joi.object({ space: CommonJoi.uid() }),
  claimSpaceControl,
);
