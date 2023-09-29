import { WEN_FUNC } from '@build-5/interfaces';
import { stampCreateControl } from '../../../controls/stamp/stamp.create';
import { onRequest } from '../common';
import { stampSchema } from './StampRequestSchema';

export const stamp = onRequest(WEN_FUNC.stamp)(stampSchema, stampCreateControl);
