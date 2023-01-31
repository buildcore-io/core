import { WEN_FUNC } from '@soonaverse/interfaces';
import Joi from 'joi';
import { claimSpaceControl } from '../../../controls/space/space.claim.control';
import { onCall } from '../../../firebase/functions/onCall';
import { scale } from '../../../scale.settings';
import { CommonJoi } from '../../../services/joi/common';

export const claimSpace = onCall({
  minInstances: scale(WEN_FUNC.claimSpace),
})(WEN_FUNC.claimSpace, Joi.object({ space: CommonJoi.uid() }), claimSpaceControl);
