/**
 * This file was automatically generated by joi-to-typescript
 * Do not modify this file manually
 */

/**
 * Request object to create a space.
 */
export interface SpaceCreateRequest {
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
   * Name of the space.
   */
  name?: string | null | '';
  /**
   * If true, anyone can instantly join this space.
   */
  open?: false | true;
  /**
   * Twitter url of ths space
   */
  twitter?: string | null | '';
}
