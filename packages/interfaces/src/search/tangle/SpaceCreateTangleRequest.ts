/**
 * This file was automatically generated by joi-to-typescript
 * Do not modify this file manually
 */

/**
 * Tangle request object to create a space.
 */
export interface SpaceCreateTangleRequest {
  /**
   * Information about the space.
   */
  about?: string | null | '';
  /**
   * Avatar url of ths space
   */
  avatarUrl?: string | null | '';
  bannerUrl?: string;
  /**
   * Discord url of the space.
   */
  discord?: string | null | '';
  /**
   * Github url of ths space
   */
  github?: string | null | '';
  /**
   * Name of the space.
   */
  name?: string | null | '';
  /**
   * If true, anyone can instantly join this space.
   */
  open?: false | true;
  /**
   * Type of the tangle request.
   */
  requestType: 'SPACE_CREATE';
  /**
   * Twitter url of ths space
   */
  twitter?: string | null | '';
}
