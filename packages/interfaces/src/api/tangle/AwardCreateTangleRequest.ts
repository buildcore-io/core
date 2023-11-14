/**
 * This file was automatically generated by joi-to-typescript
 * Do not modify this file manually
 */

/**
 * Tangle request object to create an award
 */
export interface AwardCreateTangleRequest {
  badge?: {
    /**
     * Description of the badge
     */
    description?: string | null | '';
    image?: string;
    /**
     * The time for which the reward nft will be locked.
     */
    lockTime: number;
    /**
     * Name of the badge
     */
    name: string;
    /**
     * The amount of token rewarded with this badge.
     */
    tokenReward: number;
    /**
     * The symbol of the reward token.
     */
    tokenSymbol: string;
    /**
     * Total noumber of bages that can be issued. Minimum 1, maximum 10000
     */
    total: number;
  };
  /**
   * Description of the award
   */
  description?: string | null | '';
  /**
   * End date of the award issuing period.
   */
  endDate: Date;
  /**
   * Name of the award
   */
  name: string;
  /**
   * Network on which the award will be minted and issued
   */
  network: 'iota' | 'smr' | 'atoi' | 'rms';
  /**
   * Type of the tangle request.
   */
  requestType: 'AWARD_CREATE';
  /**
   * Build5 id of the space
   */
  space: string;
}
