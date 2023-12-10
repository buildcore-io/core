import {
  ClaimAirdroppedTokensTangleRequest,
  Network,
  TangleRequestType,
  TokenStakeTangleRequest,
  TradeTokenTangleRequest,
} from '@build-5/interfaces';
import { DatasetClass, OtrRequest } from './common';

export class TokenOtrDataset extends DatasetClass {
  sellBaseToken = (symbol: string, count: number, price: number) => {
    if (!Object.values(Network).includes(symbol.toLowerCase() as Network)) {
      throw Error('Invalid base token symbol');
    }
    return new OtrRequest<TradeTokenTangleRequest>(
      this.otrAddress,
      {
        requestType: TangleRequestType.SELL_TOKEN,
        symbol,
        count,
        price,
      },
      Math.floor(count * price),
    );
  };

  sellMintedToken = (tokenId: string, symbol: string, count: number, price: number) =>
    new OtrRequest<TradeTokenTangleRequest>(
      this.otrAddress,
      {
        requestType: TangleRequestType.SELL_TOKEN,
        symbol,
        count,
        price,
      },
      undefined,
      { amount: BigInt(count), id: tokenId },
    );

  buyToken = (symbol: string, count: number, price: number) =>
    new OtrRequest<TradeTokenTangleRequest>(
      this.otrAddress,
      {
        requestType: TangleRequestType.BUY_TOKEN,
        symbol,
        count,
        price,
      },
      Math.floor(count * price),
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

  claimAirdrops = (symbol: string) =>
    new OtrRequest<ClaimAirdroppedTokensTangleRequest>(this.otrAddress, {
      requestType: TangleRequestType.CLAIM_MINTED_AIRDROPS,
      symbol,
    });
}
