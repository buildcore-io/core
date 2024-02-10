import {
  ClaimAirdroppedTokensTangleRequest,
  TangleRequestType,
  TokenStakeTangleRequest,
  TradeTokenTangleRequest,
} from '@build-5/interfaces';
import { DatasetClass, OtrRequest } from './common';

/**
 * Token OTR Dataset
 */
export class TokenOtrDataset extends DatasetClass {
  /**
   * Sell base token via OTR
   *
   * @param params Use {@link OtrRequest} with data based on {@link TradeTokenTangleRequest}
   * @returns
   */
  sellBaseToken = (params: Omit<TradeTokenTangleRequest, 'requestType'>) => {
    delete params.symbol;
    return new OtrRequest<TradeTokenTangleRequest>(
      this.otrAddress,
      { ...params, requestType: TangleRequestType.SELL_TOKEN },
      Math.floor((params.count || 0) * (params.price || 0)),
    );
  };
  /**
   * Sell minted token
   *
   * @param params Use {@link OtrRequest} with data based on {@link TradeTokenTangleRequest}
   * @returns
   */
  sellMintedToken = (tokenId: string, params: Omit<TradeTokenTangleRequest, 'requestType'>) =>
    new OtrRequest<TradeTokenTangleRequest>(
      this.otrAddress,
      { ...params, requestType: TangleRequestType.SELL_TOKEN },
      undefined,
      { amount: BigInt(params.count || 0), id: tokenId },
    );
  /**
   * Buy token.
   *
   * @param params Use {@link OtrRequest} with data based on {@link TradeTokenTangleRequest}
   * @returns
   */
  buyToken = (params: Omit<TradeTokenTangleRequest, 'requestType'>) =>
    new OtrRequest<TradeTokenTangleRequest>(
      this.otrAddress,
      { ...params, requestType: TangleRequestType.BUY_TOKEN },
      Math.floor((params.count || 0) * (params.price || 0)),
    );
  /**
   * Stake token
   *
   * @param params Use {@link OtrRequest} with data based on {@link TokenStakeTangleRequest}
   * @returns
   */
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
  /**
   * Claim airdrop
   *
   * @param params Use {@link OtrRequest} with data based on {@link ClaimAirdroppedTokensTangleRequest}
   * @returns
   */
  claimAirdrops = (params: Omit<ClaimAirdroppedTokensTangleRequest, 'requestType'>) =>
    new OtrRequest<ClaimAirdroppedTokensTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.CLAIM_MINTED_AIRDROPS,
    });
}
