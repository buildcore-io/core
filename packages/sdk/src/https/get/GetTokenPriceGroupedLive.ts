import { ApiRoutes } from '@build-5/interfaces';
import { GetByIdGroupedLiveClass } from './GetByIdGroupedLive';
import { CreateUrlResponse } from './common';

export class GetTokenPriceGroupedLiveClass extends GetByIdGroupedLiveClass {
  protected createUrl = () =>
    Object.values(this.groupRequests()).map((r) => {
      const params = { token: r.map((r) => r.setId) };
      const url = r[0].origin + ApiRoutes.GET_TOKEN_PRICE;
      return { requests: r, url, params } as CreateUrlResponse;
    });
}

const GetTokenPriceGroupedLive = new GetTokenPriceGroupedLiveClass();
export default GetTokenPriceGroupedLive;
