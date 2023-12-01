import {
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
  airdropToken = this.sendRequest(WEN_FUNC.airdropToken)<CreateAirdropsRequest, void>;

  airdropMintedToken = this.sendRequest(WEN_FUNC.airdropMintedToken)<
    CreateAirdropsRequest,
    Transaction
  >;

  claimMintedAirdrop = this.sendRequest(WEN_FUNC.claimMintedTokenOrder)<
    ClaimAirdroppedTokensRequest,
    Transaction
  >;

  claimAirdropped = this.sendRequest(WEN_FUNC.claimAirdroppedToken)<
    ClaimPreMintedAirdroppedTokensRequest,
    Transaction
  >;
}
