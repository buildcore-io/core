import { NetworkAddress } from '../../models';

/**
 * Tangle response object returned after editing a sapce guardian
 */
export interface SpaceGuardianUpsertTangleResponse {
  /**
   * Build5 id of the created proposal
   */
  proposal: NetworkAddress;
}
