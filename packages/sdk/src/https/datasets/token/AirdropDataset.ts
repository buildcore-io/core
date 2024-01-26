import {
  Build5Request,
  ClaimAirdroppedTokensRequest,
  ClaimPreMintedAirdroppedTokensRequest,
  CreateAirdropsRequest,
  Dataset,
  TokenDrop,
  Transaction,
  WEN_FUNC,
} from '@build-5/interfaces';
import { DatasetClass } from '../Dataset';

/**
 * Airdrop dataset.
 */
export class AirdropDataset<D extends Dataset> extends DatasetClass<D, TokenDrop> {
  /**
   * Airdrop tokens.
   *
   * @param req Use {@link Build5Request} with data based on {@link CreateAirdropsRequest}
   * @returns
   */
  airdropToken = (req: Build5Request<CreateAirdropsRequest>) =>
    this.sendRequest(WEN_FUNC.airdropToken)<CreateAirdropsRequest, void>(req);
  /**
   * Airdrop minted tokens.
   *
   * @param req Use {@link Build5Request} with data based on {@link CreateAirdropsRequest}
   * @returns
   */
  airdropMintedToken = (req: Build5Request<CreateAirdropsRequest>) =>
    this.sendRequest(WEN_FUNC.airdropMintedToken)<CreateAirdropsRequest, Transaction>(req);
  /**
   * Claimed minted token airdrop.
   *
   * @param req Use {@link Build5Request} with data based on {@link ClaimAirdroppedTokensRequest}
   * @returns
   */
  claimMintedAirdrop = (req: Build5Request<ClaimAirdroppedTokensRequest>) =>
    this.sendRequest(WEN_FUNC.claimMintedTokenOrder)<ClaimAirdroppedTokensRequest, Transaction>(
      req,
    );
  /**
   * Claim token airdrop.
   *
   * @param req Use {@link Build5Request} with data based on {@link ClaimPreMintedAirdroppedTokensRequest}
   * @returns
   */
  claimAirdropped = (req: Build5Request<ClaimPreMintedAirdroppedTokensRequest>) =>
    this.sendRequest(WEN_FUNC.claimAirdroppedToken)<
      ClaimPreMintedAirdroppedTokensRequest,
      Transaction
    >(req);
}
