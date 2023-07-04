import {
  ClaimAirdroppedTokensRequest,
  ImportMintedTokenRequest,
  TokenMintRequest,
  WEN_FUNC,
} from '@build-5/interfaces';
import Joi from 'joi';
import { AVAILABLE_NETWORKS } from '../../../../controls/common';
import { airdropMintedTokenControl } from '../../../../controls/token-minting/airdrop-minted-token';
import { claimMintedTokenControl } from '../../../../controls/token-minting/claim-minted-token.control';
import { importMintedTokenControl } from '../../../../controls/token-minting/import-minted-token';
import { mintTokenControl } from '../../../../controls/token-minting/token-mint.control';
import { onRequest } from '../../../../firebase/functions/onRequest';
import { CommonJoi, toJoiObject } from '../../../../services/joi/common';
import { networks } from '../../../../utils/config.utils';
import { airdropTokenSchema } from '../base';

export const airdropMintedToken = onRequest(WEN_FUNC.airdropMintedToken)(
  airdropTokenSchema,
  airdropMintedTokenControl,
);

const symbolSchema = toJoiObject<ClaimAirdroppedTokensRequest>({ symbol: CommonJoi.tokenSymbol() });

export const claimMintedTokenOrder = onRequest(WEN_FUNC.claimMintedTokenOrder)(
  symbolSchema,
  claimMintedTokenControl,
);

const availaibleNetworks = AVAILABLE_NETWORKS.filter((n) => networks.includes(n));

const mintTokenSchema = toJoiObject<TokenMintRequest>({
  token: CommonJoi.uid(),
  network: Joi.string()
    .equal(...availaibleNetworks)
    .required(),
});
export const mintTokenOrder = onRequest(WEN_FUNC.mintTokenOrder)(mintTokenSchema, mintTokenControl);

const importMintedTokenSchema = toJoiObject<ImportMintedTokenRequest>({
  tokenId: CommonJoi.uid(),
  space: CommonJoi.uid(),
  network: Joi.string()
    .equal(...availaibleNetworks)
    .required(),
});

export const importMintedToken = onRequest(WEN_FUNC.importMintedToken)(
  importMintedTokenSchema,
  importMintedTokenControl,
);
