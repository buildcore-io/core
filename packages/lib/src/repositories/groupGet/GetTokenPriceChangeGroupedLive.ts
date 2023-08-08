import { GetPriceChangeResponse } from '@build-5/interfaces';
import { getPriceChangeUrl } from '../../Config';
import { GetByIdGroupedLive } from './GetByIdGroupedLive';
import { BATCH_MAX_SIZE, CreateUrlResponse } from './common';

export class GetTokenPriceChangeGroupedLive extends GetByIdGroupedLive<GetPriceChangeResponse> {
  protected createUrl = (sessionId?: string) => {
    const requests = this.requests.splice(0, BATCH_MAX_SIZE);
    const params = { token: requests.map((r) => r.uid), sessionId };
    const url = getPriceChangeUrl(this.env);
    return { requests, url, params } as CreateUrlResponse;
  };
}
