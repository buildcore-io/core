import { WEN_FUNC } from '@build-5/interfaces';
import { rankControl } from '../../../controls/rank.control';
import { rankSchema } from './RankRequestSchema';
import { onRequest } from '../common';

export const rankController = onRequest(WEN_FUNC.rankController)(rankSchema, rankControl);
