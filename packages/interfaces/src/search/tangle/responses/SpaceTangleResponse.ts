import { TangleResponse } from './TangleResponse';

/**
 * Tangle response object returned after creating a space
 */
export interface SpaceCreateTangleResponse extends TangleResponse {
  /**
   * Build5 id of the created space
   */
  space: string;
}

/**
 * Tangle response object returned after editing a sapce guardian
 */
export interface SpaceGuardianUpsertTangleResponse extends TangleResponse {
  /**
   * Build5 id of the created proposal
   */
  proposal: string;
}
