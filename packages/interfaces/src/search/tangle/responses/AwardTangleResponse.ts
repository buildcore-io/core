import { NativeToken, NetworkAddress } from '../../../models';
import { ApiError } from '../../post/common';
import { TangleResponse } from './TangleResponse';

/**
 * Tangle response object returned after approving award participation
 */
export interface AwardApproveParticipantTangleResponse extends TangleResponse {
  /**
   * Key value pair for the received badges where
   * key is the buildcore id/wallet address of the member
   * value is the buildcore id of the badge transaction
   */
  badges: { [key: string]: string };
  /**
   * Key value pair representing badge issuing errors
   * key is the buildcore id/wallet address of the member
   * value is information about the error
   */
  errors: { [key: string]: ApiError };
}

/**
 * Tangle response object returned after creating an award
 */
export interface AwardCreateTangleResponse extends TangleResponse {
  /**
   * Buildcore id of the award created
   */
  award: NetworkAddress;
  /**
   * Native token count in case the award type is Native
   */
  nativeTokens?: NativeToken[];
}
