import {
  ApiRoutes,
  CancelTokenTradeOrderRequest,
  Dataset,
  GetManyAdvancedRequest,
  Opr,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
  TradeTokenRequest,
  Transaction,
  WEN_FUNC,
} from '@build-5/interfaces';
import { from, map, switchMap } from 'rxjs';
import { wrappedFetch } from '../../fetch.utils';
import GetTokenPriceGrouped from '../../get/GetTokenPriceGrouped';
import GetTokenPriceGroupedLive from '../../get/GetTokenPriceGroupedLive';
import { DatasetClass } from '../Dataset';

export class TokenMarketDataset<D extends Dataset> extends DatasetClass<D, TokenTradeOrder> {
  tradeToken = this.sendRequest(WEN_FUNC.tradeToken)<
    TradeTokenRequest,
    Transaction | TokenTradeOrder
  >;

  cancelTradeOrder = this.sendRequest(WEN_FUNC.cancelTradeOrder)<
    CancelTokenTradeOrderRequest,
    TokenTradeOrder
  >;

  getTokenPrice = (token: string) =>
    GetTokenPriceGrouped.get({ origin: this.origin, dataset: this.dataset, setId: token });

  getTokenPriceLive = (token: string) =>
    from(
      GetTokenPriceGroupedLive.get({ origin: this.origin, dataset: this.dataset, setId: token }),
    ).pipe(
      switchMap((inner) => inner),
      map((r) => r || { id: token, price: 0, usdPrice: 0 }),
    );

  getTokenPriceInUsd = async (token: string) => {
    const url = this.origin + ApiRoutes.GET_TOKEN_PRICE;
    const response = await wrappedFetch(this.origin, url, { token });
    return (response as Record<string, unknown>).usdPrice;
  };

  getBidsLive = (
    token: string,
    type: TokenTradeOrderType,
    status: TokenTradeOrderStatus,
    startAfter?: string,
  ) => {
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      fieldName: ['token', 'type', 'status'],
      fieldValue: [token, type, status],
      operator: [Opr.EQUAL, Opr.EQUAL, Opr.EQUAL],
      startAfter,
      orderBy: ['price'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };

  getMemberBidsLive = (
    token: string,
    member: string,
    type: TokenTradeOrderType,
    startAfter?: string,
  ) => {
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      fieldName: ['token', 'owner', 'type'],
      fieldValue: [token, member, type],
      operator: [Opr.EQUAL, Opr.EQUAL, Opr.EQUAL],
      startAfter,
      orderBy: ['createdOn'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };
}
