import { Transaction } from '../../models';
import { ApiError } from './common';

export interface AwardApproveParticipantResponse {
  badges: { [key: string]: Transaction };
  errors: { [key: string]: ApiError };
}
