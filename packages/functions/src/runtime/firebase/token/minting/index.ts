import { WEN_FUNC } from '@build-5/interfaces';
import { airdropMintedTokenControl } from '../../../../controls/token-minting/airdrop-minted-token';
import { claimMintedTokenControl } from '../../../../controls/token-minting/claim-minted-token.control';
import { importMintedTokenControl } from '../../../../controls/token-minting/import-minted-token';
import { mintTokenControl } from '../../../../controls/token-minting/token-mint.control';
import { onRequest } from '../../../../firebase/functions/onRequest';
import { airdropTokenSchema } from '../base/TokenAirdropRequestSchema';
import { symbolSchema } from './TokenClaimMintedRequestSchema';
import { importMintedTokenSchema } from './TokenImportRequestSchema';
import { mintTokenSchema } from './TokenMintRequestSchema';

export const airdropMintedToken = onRequest(WEN_FUNC.airdropMintedToken)(
  airdropTokenSchema,
  airdropMintedTokenControl,
);

export const claimMintedTokenOrder = onRequest(WEN_FUNC.claimMintedTokenOrder)(
  symbolSchema,
  claimMintedTokenControl,
);

export const mintTokenOrder = onRequest(WEN_FUNC.mintTokenOrder)(mintTokenSchema, mintTokenControl);

export const importMintedToken = onRequest(WEN_FUNC.importMintedToken)(
  importMintedTokenSchema,
  importMintedTokenControl,
);
