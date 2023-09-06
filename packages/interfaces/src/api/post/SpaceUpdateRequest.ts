/**
 * This file was automatically generated by joi-to-typescript
 * Do not modify this file manually
 */

/**
 * Request object to update a space.
 */
export interface SpaceUpdateRequest {
  /**
   * Information about the space.
   */
  about?: string | null | '';
  /**
   * Avatar url of ths space
   */
  avatarUrl?: string | null | '';
  /**
   * Banner url of ths space
   */
  bannerUrl?: string | null | '';
  /**
   * Discord url of the space.
   */
  discord?: string | null | '';
  /**
   * Github url of ths space
   */
  github?: string | null | '';
  /**
   * If tokenBase is set to true, it defines the minimum stake joining value for the space. Minimum 1, maximum 1e+26
   */
  minStakedValue?: number;
  /**
   * Name of the space.
   */
  name?: string | null | '';
  /**
   * If true, anyone can instantly join this space.
   */
  open?: false | true;
  /**
   * Set or unset the space to be token based.
   */
  tokenBased?: false | true;
  /**
   * Twitter url of ths space
   */
  twitter?: string | null | '';
  /**
   * Build5 id of the space.
   */
  uid: string;
}
