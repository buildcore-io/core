/**
 * This file was automatically generated by joi-to-typescript
 * Do not modify this file manually
 */

/**
 * Request object to mint a tokens.
 */
export interface TokenMintRequest {
  /**
   * Network to use to mint the token.
   */
  network: 'iota' | 'smr' | 'atoi' | 'rms';
  /**
   * Buildcore id of the token to mint.
   */
  token: string;
}
