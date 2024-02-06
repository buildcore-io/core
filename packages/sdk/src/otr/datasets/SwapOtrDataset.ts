import {
  SwapCreateTangleRequest,
  SwapRejectTangleRequest,
  SwapSetFundedTangleRequest,
  TangleRequestType,
} from '@build-5/interfaces';
import { DatasetClass, OtrRequest } from './common';

/**
 * Swap OTR Dataset
 */
export class SwapOtrDataset extends DatasetClass {
  /**
   * Create a swap
   *
   * @param params Use {@link SwapCreateTangleRequest}
   * @returns
   */
  create = (params: Omit<SwapCreateTangleRequest, 'requestType'>) =>
    new OtrRequest<SwapCreateTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.CREATE_SWAP,
    });

  /**
   * Set a swap as funded
   *
   * @param params Use {@link SwapSetFundedTangleRequest}
   * @returns
   */
  setFunded = (params: Omit<SwapSetFundedTangleRequest, 'requestType'>) =>
    new OtrRequest<SwapSetFundedTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.SET_SWAP_FUNDED,
    });

  /**
   * Reject a swap
   *
   * @param params Use {@link SwapRejectTangleRequest}
   * @returns
   */
  reject = (params: Omit<SwapRejectTangleRequest, 'requestType'>) =>
    new OtrRequest<SwapRejectTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.REJECT_SWAP,
    });
}
