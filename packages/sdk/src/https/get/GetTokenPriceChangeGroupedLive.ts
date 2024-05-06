import { ApiRoutes } from '@buildcore/interfaces';
import { GetByIdGroupedLiveClass } from './GetByIdGroupedLive';
import { CreateUrlResponse } from './common';

class GetTokenPriceChangeGroupedLiveClass extends GetByIdGroupedLiveClass {
  protected createUrl = () =>
    Object.values(this.groupRequests()).map((r) => {
      const params = { token: r.map((r) => r.setId) };
      const url = r[0].origin + ApiRoutes.GET_PRICE_CHANGE;
      return { requests: r, url, params } as CreateUrlResponse;
    });
}
const GetTokenPriceChangeGroupedLive = new GetTokenPriceChangeGroupedLiveClass();
export default GetTokenPriceChangeGroupedLive;
