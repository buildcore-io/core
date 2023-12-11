import {
  ClaimAirdroppedTokensTangleRequest,
  Network,
  TangleRequestType,
  TokenStakeTangleRequest,
  TradeTokenTangleRequest,
} from '@build-5/interfaces';
import { DatasetClass, OtrRequest } from './common';

export class TokenOtrDataset extends DatasetClass {
  sellBaseToken = (params: Omit<TradeTokenTangleRequest, 'requestType'>) => {
    if (!Object.values(Network).includes(params.symbol.toLowerCase() as Network)) {
      throw Error('Invalid base token symbol');
    }
    return new OtrRequest<TradeTokenTangleRequest>(
      this.otrAddress,
      {
        ...params,
        requestType: TangleRequestType.SELL_TOKEN,
      },
      Math.floor((params.count || 0) * params.price),
    );
  };

  sellMintedToken = (tokenId: string, params: Omit<TradeTokenTangleRequest, 'requestType'>) =>
    new OtrRequest<TradeTokenTangleRequest>(
      this.otrAddress,
      { ...params, requestType: TangleRequestType.SELL_TOKEN },
      undefined,
      { amount: BigInt(params.count || 0), id: tokenId },
    );

  buyToken = (params: Omit<TradeTokenTangleRequest, 'requestType'>) =>
    new OtrRequest<TradeTokenTangleRequest>(
      this.otrAddress,
      { ...params, requestType: TangleRequestType.BUY_TOKEN },
      Math.floor((params.count || 0) * params.price),
    );

  stake = (tokenId: string, count: number, params: Omit<TokenStakeTangleRequest, 'requestType'>) =>
    new OtrRequest<TokenStakeTangleRequest>(
      this.otrAddress,
      {
        requestType: TangleRequestType.STAKE,
        ...params,
      },
      undefined,
      { amount: BigInt(count), id: tokenId },
    );

  claimAirdrops = (params: Omit<ClaimAirdroppedTokensTangleRequest, 'requestType'>) =>
    new OtrRequest<ClaimAirdroppedTokensTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.CLAIM_MINTED_AIRDROPS,
    });
}
