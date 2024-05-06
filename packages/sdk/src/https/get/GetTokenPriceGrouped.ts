import { ApiRoutes } from '@buildcore/interfaces';
import { GetByIdGroupedClass } from './GetByIdGrouped';
import { CreateUrlResponse } from './common';

class GetTokenPriceGroupedClass extends GetByIdGroupedClass {
  protected createUrl = () =>
    Object.values(this.groupRequests()).map((r) => {
      const params = { token: r.map((r) => r.setId) };
      const url = r[0].origin + ApiRoutes.GET_TOKEN_PRICE;
      return { requests: r, url, params } as CreateUrlResponse;
    });
}

const GetTokenPriceGrouped = new GetTokenPriceGroupedClass();
export default GetTokenPriceGrouped;
