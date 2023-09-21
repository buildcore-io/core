/**
 * This file was automatically generated by joi-to-typescript
 * Do not modify this file manually
 */

/**
 * Request object to create a project.
 */
export interface ProjectCreateRequest {
  /**
   * Config for this project.
   */
  config: {
    /**
     * Base token symbol for this project. Set only if billing type is token_based
     */
    baseTokenSymbol?: string;
    /**
     * Base token uid for this project. Set only if billing type is token_based
     */
    baseTokenUid?: string;
    /**
     * Billing type of the project.
     */
    billing: 'token_based' | 'volume_based';
    /**
     * Tiers for this project. Set only if billing type is token_based
     */
    tiers?: any[];
    /**
     * Discounts for this project. Set only if billing type is token_based
     */
    tokenTradingFeeDiscountPercentage?: any[];
  };
  /**
   * Email address of a contact for the project.
   */
  contactEmail?: string;
  /**
   * Name of the project. Minimum 3, maximum 40 character
   */
  name: string;
}
