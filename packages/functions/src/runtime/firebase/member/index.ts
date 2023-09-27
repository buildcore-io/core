import { WEN_FUNC, WenError } from '@build-5/interfaces';
import cors from 'cors';
import * as functions from 'firebase-functions/v2';
import { createMemberControl } from '../../../controls/member/member.create';
import { updateMemberControl } from '../../../controls/member/member.update';
import { assertValidationAsync } from '../../../utils/schema.utils';
import { onRequest, onRequestConfig } from '../common';
import { createMemberSchema } from './CreateMemberRequestSchema';
import { updateMemberSchema } from './UpdateMemberRequestSchema';

export const createMember = functions.https.onRequest(
  onRequestConfig(WEN_FUNC.createMember),
  (req, res) =>
    cors({ origin: true })(req, res, async () => {
      try {
        const address = req.body.data as string;
        await assertValidationAsync(createMemberSchema, { address });
        res.send({ data: await createMemberControl({ owner: address, ip: '', project: '' }) });
      } catch (error) {
        res.status(401);
        res.send({ data: WenError.address_must_be_provided });
      }
    }),
);

export const updateMember = onRequest(WEN_FUNC.updateMember)(
  updateMemberSchema,
  updateMemberControl,
);
