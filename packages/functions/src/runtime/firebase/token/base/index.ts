import { WEN_FUNC } from '@build-5/interfaces';
import { airdropTokenControl } from '../../../../controls/token/token.airdrop';
import { claimAirdroppedTokenControl } from '../../../../controls/token/token.airdrop.claim';
import { cancelPublicSaleControl } from '../../../../controls/token/token.cancel.pub.sale';
import { createTokenControl } from '../../../../controls/token/token.create';
import { creditTokenControl } from '../../../../controls/token/token.credit';
import { enableTokenTradingControl } from '../../../../controls/token/token.enable.trading';
import { orderTokenControl } from '../../../../controls/token/token.order';
import { setTokenAvailableForSaleControl } from '../../../../controls/token/token.set.for.sale';
import { updateTokenControl } from '../../../../controls/token/token.update';
import { onRequest } from '../../../../firebase/functions/onRequest';
import { toJoiObject } from '../../../../services/joi/common';
import { UidSchemaObject, uidSchema } from '../../common';
import { airdropTokenSchema } from './TokenAirdropRequestSchema';
import { cancelPubSaleSchema } from './TokenCancelPubSaleRequestSchema';
import { claimAirdroppedTokenSchema } from './TokenClaimAirdroppedRequestSchema';
import { createTokenSchema } from './TokenCreateRequestSchema';
import { creditTokenSchema } from './TokenCreditRequestSchema';
import { enableTradingSchema } from './TokenEnableTradingRequestSchema';
import { orderTokenSchema } from './TokenOrderRequestSchema';
import { setAvailableForSaleSchema } from './TokenSetAvailableForSaleRequestSchema';

export const createToken = onRequest(WEN_FUNC.createToken)(createTokenSchema, createTokenControl);

export const updateToken = onRequest(WEN_FUNC.updateToken)(
  toJoiObject<UidSchemaObject>(uidSchema),
  updateTokenControl,
  true,
);

export const setTokenAvailableForSale = onRequest(WEN_FUNC.setTokenAvailableForSale)(
  setAvailableForSaleSchema,
  setTokenAvailableForSaleControl,
);

export const cancelPublicSale = onRequest(WEN_FUNC.cancelPublicSale)(
  cancelPubSaleSchema,
  cancelPublicSaleControl,
);

export const creditToken = onRequest(WEN_FUNC.creditToken)(creditTokenSchema, creditTokenControl);

export const orderToken = onRequest(WEN_FUNC.orderToken)(orderTokenSchema, orderTokenControl);

export const enableTokenTrading = onRequest(WEN_FUNC.enableTokenTrading)(
  enableTradingSchema,
  enableTokenTradingControl,
);

export const airdropToken = onRequest(WEN_FUNC.airdropToken)(
  airdropTokenSchema,
  airdropTokenControl,
);

export const claimAirdroppedToken = onRequest(WEN_FUNC.claimAirdroppedToken)(
  claimAirdroppedTokenSchema,
  claimAirdroppedTokenControl,
);
