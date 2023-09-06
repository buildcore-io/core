import { WEN_FUNC } from '@build-5/interfaces';
import { voteControl } from '../../../controls/vote.control';
import { onRequest } from '../../../firebase/functions/onRequest';
import { voteSchema } from './VoteRequestSchema';

export const voteController = onRequest(WEN_FUNC.voteController)(voteSchema, voteControl);
