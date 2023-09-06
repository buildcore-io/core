import { WEN_FUNC } from '@build-5/interfaces';
import { voteControl } from '../../../controls/vote.control';
import { voteSchema } from './VoteRequestSchema';
import { onRequest } from '../common';

export const voteController = onRequest(WEN_FUNC.voteController)(voteSchema, voteControl);
