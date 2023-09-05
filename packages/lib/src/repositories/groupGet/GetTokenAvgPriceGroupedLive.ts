import { GetAvgPriceResponse } from '@build-5/interfaces';
import { getAvgPriceUrl } from '../../Config';
import { GetByIdGroupedLive } from './GetByIdGroupedLive';
import { BATCH_MAX_SIZE, CreateUrlResponse } from './common';

export class GetTokenAvgPriceGroupedLive extends GetByIdGroupedLive<GetAvgPriceResponse> {
  protected createUrl = () => {
    const requests = this.requests.splice(0, BATCH_MAX_SIZE);
    const params = { token: requests.map((r) => r.uid) };
    const url = getAvgPriceUrl(this.env);
    return { requests, url, params } as CreateUrlResponse;
  };
}
