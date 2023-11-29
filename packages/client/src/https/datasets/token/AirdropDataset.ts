import {
  ClaimAirdroppedTokensRequest,
  ClaimPreMintedAirdroppedTokensRequest,
  CreateAirdropsRequest,
  Dataset,
  TokenDrop,
  WEN_FUNC,
} from '@build-5/interfaces';
import { DatasetClass } from '../Dataset';

export class AirdropDataset<D extends Dataset> extends DatasetClass<D, TokenDrop> {
  airdropToken = this.sendRequest(WEN_FUNC.airdropToken)<CreateAirdropsRequest>;

  airdropMintedToken = this.sendRequest(WEN_FUNC.airdropMintedToken)<CreateAirdropsRequest>;

  claimMintedAirdrop = this.sendRequest(
    WEN_FUNC.claimMintedTokenOrder,
  )<ClaimAirdroppedTokensRequest>;

  claimAirdropped = this.sendRequest(
    WEN_FUNC.claimAirdroppedToken,
  )<ClaimPreMintedAirdroppedTokensRequest>;
}
