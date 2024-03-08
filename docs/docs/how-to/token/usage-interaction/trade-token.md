---
title: Trade Token
tags:
  - how-to
  - trade
  - token
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs groupId="request-type">
  <TabItem value="otr" label="OTR">
    There is different ways to trade token over OTR.
    
    To buy token, you must call [`buyToken`](../../../reference-api/classes/TokenOtrDataset.md#buytoken) on `dataset(Dataset.TOKEN)`. [`buyToken`](../../../reference-api/classes/TokenOtrDataset.md#buytoken) takes an object of type [`TradeTokenTangleRequest`](../../../reference-api/interfaces/TradeTokenTangleRequest.md) as parameter in which you can specify the token you want to buy, the price for the offer and the amount.

    ```tsx file=../../../../../packages/sdk/examples/token/otr/trade.ts#L9-L13
    ```

    [`buyToken`](../../../reference-api/classes/TokenOtrDataset.md#buytoken) returns an oject of type [`OtrRequest`](../../../reference-api/classes/DatasetClassOtr.OtrRequest.md)`<`[`TradeTokenTangleRequest`](../../../reference-api/interfaces/TradeTokenTangleRequest.md)`>`


    To sell base token, you must call [`sellBaseToken`](../../../reference-api/classes/TokenOtrDataset.md#sellbasetoken) on `dataset(Dataset.TOKEN)`. [`sellBaseToken`](../../../reference-api/classes/TokenOtrDataset.md#sellbasetoken) takes an object of type [`TradeTokenTangleRequest`](../../../reference-api/interfaces/TradeTokenTangleRequest.md) as parameter in which you can specify the price for the offer and the amount.

    ```tsx file=../../../../../packages/sdk/examples/token/otr/trade.ts#L18-L22
    ```

    [`sellBaseToken`](../../../reference-api/classes/TokenOtrDataset.md#sellbasetoken) returns an oject of type [`OtrRequest`](../../../reference-api/classes/DatasetClassOtr.OtrRequest.md)`<`[`TradeTokenTangleRequest`](../../../reference-api/interfaces/TradeTokenTangleRequest.md)`>`


    To sell token, you must call [`sellMintedToken`](../../../reference-api/classes/TokenOtrDataset.md#sellmintedtoken) on `dataset(Dataset.TOKEN)`. [`sellMintedToken`](../../../reference-api/classes/TokenOtrDataset.md#sellmintedtoken) takes an object of type [`TradeTokenTangleRequest`](../../../reference-api/interfaces/TradeTokenTangleRequest.md) as parameter in which you can specify the token you want to buy, the price for the offer and the amount.

    ```tsx file=../../../../../packages/sdk/examples/token/otr/trade.ts#L27-L31
    ```

    [`sellMintedToken`](../../../reference-api/classes/TokenOtrDataset.md#sellmintedtoken) returns an oject of type [`OtrRequest`](../../../reference-api/classes/DatasetClassOtr.OtrRequest.md)`<`[`TradeTokenTangleRequest`](../../../reference-api/interfaces/TradeTokenTangleRequest.md)`>`
  </TabItem>  
  <TabItem value="https" label="HTTPS">
    To trade a token, you must call [`tradeToken`](../../../reference-api/classes/TokenMarketDataset.md#tradetoken) on `dataset(Dataset.TOKEN_MARKET)`. [`tradeToken`](../../../reference-api/classes/TokenMarketDataset.md#tradetoken) takes an object of type `Build5Request<`[`TradeTokenRequest`](../../../reference-api/interfaces/TradeTokenRequest.md)`>` as parameter in which you can specify the token you want to trade, the price for the offer and the kind of trade like buy or sell.

    ```tsx file=../../../../../packages/sdk/examples/token/https/trade.ts#L19-L35
    ```

    [`tradeToken`](../../../reference-api/classes/TokenMarketDataset.md#tradetoken) returns an oject of type [`Transaction`](../../../reference-api/interfaces/Transaction.md).
  </TabItem>
</Tabs>

Get executed trades:

```tsx file=../../../../../packages/sdk/examples/token/https/trade.ts#L49-L69
```

## Full How-To Code

<Tabs groupId="request-type">
  <TabItem value="otr" label="OTR">
    ```tsx file=../../../../../packages/sdk/examples/token/otr/trade.ts
    ```
  </TabItem>  
  <TabItem value="https" label="HTTPS">
    ```tsx file=../../../../../packages/sdk/examples/token/https/trade.ts
    ```
  </TabItem>
</Tabs>
