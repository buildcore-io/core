import {
  Build5Request,
  Dataset,
  Swap,
  SwapCreateRequest,
  SwapRejectRequest,
  SwapSetFundedRequest,
  Transaction,
  WEN_FUNC,
} from '@build-5/interfaces';
import { DatasetClass } from './Dataset';

/**
 * Swap Dataset
 */
export class SwapDataset<D extends Dataset> extends DatasetClass<D, Swap> {
  /**
   * Create a swap
   *
   * @param req Use {@link Build5Request} with data based on {@link SwapCreateRequest}
   * @returns
   */
  create = (req: Build5Request<SwapCreateRequest>) =>
    this.sendRequest(WEN_FUNC.createSwap)<SwapCreateRequest, Transaction>(req);
  /**
   * Set swap as funded
   *
   * @param req Use {@link Build5Request} with data based on {@link SwapSetFundedRequest}
   * @returns
   */
  setFunded = (req: Build5Request<SwapSetFundedRequest>) =>
    this.sendRequest(WEN_FUNC.createSwap)<SwapSetFundedRequest, Transaction>(req);
  /**
   * Reject swap
   *
   * @param req Use {@link Build5Request} with data based on {@link SwapRejectRequest}
   * @returns
   */
  reject = (req: Build5Request<SwapRejectRequest>) =>
    this.sendRequest(WEN_FUNC.createSwap)<SwapRejectRequest, Transaction>(req);
}
