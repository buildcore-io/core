import { WEN_FUNC } from '@build-5/interfaces';
import { cancelTradeOrderControl } from '../../../../controls/token-trading/token-trade-cancel.controller';
import { tradeTokenControl } from '../../../../controls/token-trading/token-trade.controller';
import { onRequest } from '../../../../firebase/functions/onRequest';
import { cancelTradeOrderSchema } from './TokenCanelTradeOrderRequestSchema';
import { tradeTokenSchema } from './TokenTradeRequestSchema';

export const cancelTradeOrder = onRequest(WEN_FUNC.cancelTradeOrder)(
  cancelTradeOrderSchema,
  cancelTradeOrderControl,
);

export const tradeToken = onRequest(WEN_FUNC.tradeToken, undefined, { convert: false })(
  tradeTokenSchema,
  tradeTokenControl,
);
