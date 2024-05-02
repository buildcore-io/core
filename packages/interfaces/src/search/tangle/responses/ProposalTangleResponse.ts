import { NetworkAddress } from '../../../models';
import { TangleResponse } from './TangleResponse';

/**
 * Tangle response object returned after voting on a proposal
 */
export interface ProposalVoteTangleResponse extends TangleResponse {
  status?: string;
  /**
   * Buildcore id of the created vote transaction
   */
  voteTransaction?: NetworkAddress;
}

/**
 * Tangle response object returned after creating a proposal
 */
export interface ProposalCreateTangleResponse extends TangleResponse {
  /**
   * Buildcore id of the created proposal
   */
  proposal: NetworkAddress;
}
