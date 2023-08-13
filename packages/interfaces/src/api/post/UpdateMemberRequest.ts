/**
 * This file was automatically generated by joi-to-typescript
 * Do not modify this file manually
 */

/**
 * Request object to update a member
 */
export interface MemberUpdateRequest {
  /**
   * Information about the member
   */
  about?: string | null | '';
  /**
   * Build5 id of the avatar to be used for this member
   */
  avatar?: string;
  /**
   * Build5 id of the nft to be used as an avatar
   */
  avatarNft?: string;
  /**
   * Discord url of the member
   */
  discord?: string | null | '';
  /**
   * Github url of the member
   */
  github?: string | null | '';
  /**
   * Name of the member
   */
  name?: string | null | '';
  /**
   * Twitter url of the member
   */
  twitter?: string | null | '';
}
