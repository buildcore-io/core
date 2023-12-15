import { ApiRoutes } from '@build-5/interfaces';
import { GetByIdGroupedLiveClass } from './GetByIdGroupedLive';
import { CreateUrlResponse } from './common';

class GetTokenAvgPriceGroupedLiveClass extends GetByIdGroupedLiveClass {
  protected createUrl = () =>
    Object.values(this.groupRequests()).map((r) => {
      const params = { token: r.map((r) => r.setId) };
      const url = r[0].origin + ApiRoutes.GET_AVG_PRICE;
      return { requests: r, url, params } as CreateUrlResponse;
    });
}

const GetTokenAvgPriceGroupedLive = new GetTokenAvgPriceGroupedLiveClass();
export default GetTokenAvgPriceGroupedLive;
