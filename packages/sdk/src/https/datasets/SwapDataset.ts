import {
  BuildcoreRequest,
  Dataset,
  Swap,
  SwapCreateRequest,
  SwapRejectRequest,
  SwapSetFundedRequest,
  Transaction,
  WEN_FUNC,
} from '@buildcore/interfaces';
import { DatasetClass } from './Dataset';

/**
 * Swap Dataset
 */
export class SwapDataset<D extends Dataset> extends DatasetClass<D, Swap> {
  /**
   * Create a swap
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link SwapCreateRequest}
   * @returns
   */
  create = (req: BuildcoreRequest<SwapCreateRequest>) =>
    this.sendRequest(WEN_FUNC.createSwap)<SwapCreateRequest, Transaction>(req);
  /**
   * Set swap as funded
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link SwapSetFundedRequest}
   * @returns
   */
  setFunded = (req: BuildcoreRequest<SwapSetFundedRequest>) =>
    this.sendRequest(WEN_FUNC.createSwap)<SwapSetFundedRequest, Transaction>(req);
  /**
   * Reject swap
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link SwapRejectRequest}
   * @returns
   */
  reject = (req: BuildcoreRequest<SwapRejectRequest>) =>
    this.sendRequest(WEN_FUNC.createSwap)<SwapRejectRequest, Transaction>(req);
}
