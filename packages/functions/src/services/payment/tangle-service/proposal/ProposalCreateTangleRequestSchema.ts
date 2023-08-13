import { ProposalCreateTangleRequest } from '@build-5/interfaces';
import { createProposalSchema } from '../../../../runtime/firebase/proposal/ProposalCreateRequestSchema';
import { toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const proposalCreateSchemaObject = toJoiObject<ProposalCreateTangleRequest>({
  ...baseTangleSchema,
  ...createProposalSchema,
})
  .description('Tangle request object to create a proposal')
  .meta({
    className: 'ProposalCreateTangleRequest',
  });
