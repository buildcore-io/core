import { WEN_FUNC } from '@build-5/interfaces';
import { rankControl } from '../../../controls/rank.control';
import { onRequest } from '../../../firebase/functions/onRequest';
import { rankSchema } from './RankRequestSchema';

export const rankController = onRequest(WEN_FUNC.rankController)(rankSchema, rankControl);
