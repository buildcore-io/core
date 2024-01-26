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

export class AirdropDataset<D extends Dataset> extends DatasetClass<D, TokenDrop> {
  airdropToken = (req: Build5Request<CreateAirdropsRequest>) =>
    this.sendRequest(WEN_FUNC.airdropToken)<CreateAirdropsRequest, void>(req);

  airdropMintedToken = (req: Build5Request<CreateAirdropsRequest>) =>
    this.sendRequest(WEN_FUNC.airdropMintedToken)<CreateAirdropsRequest, Transaction>(req);

  claimMintedAirdrop = (req: Build5Request<ClaimAirdroppedTokensRequest>) =>
    this.sendRequest(WEN_FUNC.claimMintedTokenOrder)<ClaimAirdroppedTokensRequest, Transaction>(
      req,
    );

  claimAirdropped = (req: Build5Request<ClaimPreMintedAirdroppedTokensRequest>) =>
    this.sendRequest(WEN_FUNC.claimAirdroppedToken)<
      ClaimPreMintedAirdroppedTokensRequest,
      Transaction
    >(req);
}
