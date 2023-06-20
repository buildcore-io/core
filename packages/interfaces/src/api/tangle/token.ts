import { TokenTradeOrderType } from '../../models';
import { ClaimAirdroppedTokensRequest } from '../post';

export type ClaimAirdroppedTokensTangleRequest = ClaimAirdroppedTokensRequest;

export interface TradeTokenTangleRequest {
  symbol: string;
  price: number;
  type: TokenTradeOrderType;
}
