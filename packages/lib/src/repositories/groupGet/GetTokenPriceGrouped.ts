import { GetTokenPriceResponse } from '@build-5/interfaces';
import { getTokenPriceUrl } from '../../Config';
import { GetByIdGrouped } from './GetByIdGrouped';
import { BATCH_MAX_SIZE, CreateUrlResponse } from './common';

export class GetTokenPriceGrouped extends GetByIdGrouped<GetTokenPriceResponse> {
  protected createUrl = () => {
    const requests = this.requests.splice(0, BATCH_MAX_SIZE);
    this.requestCounter = Math.max(this.requestCounter - BATCH_MAX_SIZE, 0);

    const params = { token: requests.map((r) => r.uid) };

    const url = getTokenPriceUrl(this.env);
    return { requests, url, params } as CreateUrlResponse;
  };
}
