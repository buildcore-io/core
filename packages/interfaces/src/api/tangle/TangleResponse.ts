import { NativeToken, NetworkAddress } from '../../models';

/**
 * A common Tangle response object returned various tangle requests
 */
export interface BaseTangleResponse {
  /**
   * Status of the request
   */
  readonly status?: string;
  /**
   * Amount needed to perform the request
   */
  readonly amount?: number;
  /**
   * Target address that needs to be funded to perform the request
   */
  readonly address?: NetworkAddress;
  /**
   * Error code, in case of failure.
   */
  readonly code?: number;
  /**
   * Error message, in case of failure.
   */
  readonly message?: string;
  /**
   * Native token count in case the request needs native tokens to perform
   */
  readonly nativeTokens?: NativeToken[];
}
