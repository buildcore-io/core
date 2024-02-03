---
title: Trade Token
tags:
  - how-to
  - trade
  - token
---

To trade a token, you must call [`tradeToken`](../../../reference-api/classes/TokenDataset#tradeToken) on `dataset(Dataset.TOKEN)`. [`tradeToken`](../../../reference-api/classes/TokenDataset#tradeToken) takes an object of type `Build5Request<`[`TradeTokenRequest`](../../../reference-api/interfaces/TradeTokenRequest.md)`>` as parameter in which you can specify the token you want to trade, the price for the offer and the kind of trade like buy or sell.

```tsx file=../../../../../packages/sdk/examples/token/https/create.ts#L19-L35
```
