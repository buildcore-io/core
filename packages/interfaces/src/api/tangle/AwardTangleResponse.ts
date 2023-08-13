import { EthAddress, IotaAddress, NativeToken } from '../../models';
import { ApiError } from '../post/common';

/**
 * Tangle response object returned after approving award participation
 */
export interface AwardApproveParticipantTangleResponse {
  /**
   * Key value pair for the received badges where
   * key is the build5 id/wallet address of the member
   * value is the build5 id of the badge transaction
   */
  badges: { [key: string]: string };
  /**
   * Key value pair representing badge issuing errors
   * key is the build5 id/wallet address of the member
   * value is information about the error
   */
  errors: { [key: string]: ApiError };
}

/**
 * Tangle response object returned after creating an award
 */
export interface AwardCreateTangleResponse {
  /**
   * Build5 id of the award created
   */
  award: EthAddress;
  /**
   * Amount that is needed to fund the award
   */
  amount: number;
  /**
   * Target address that needs to be funded to fund the award
   */
  address: IotaAddress;
  /**
   * Native token count in case the award type is Native
   */
  nativeTokens?: NativeToken[];
}
