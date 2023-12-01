import { NetworkAddress } from '../../models';

/**
 * Tangle response object returned after voting on a proposal
 */
export interface ProposalVoteTangleResponse {
  /**
   * Status of the request
   */
  status?: string;
  /**
   * Build5 id of the created vote transaction
   */
  voteTransaction?: NetworkAddress;
}

/**
 * Tangle response object returned after creating a proposal
 */
export interface ProposalCreateTangleResponse {
  /**
   * Build5 id of the created proposal
   */
  proposal: NetworkAddress;
}
