---
title: Enable Trading
tags:
  - how-to
  - sale
  - token
---

## Example

To enable trading for your token, you must call [`enableTrading`](../../../reference-api/classes/TokenDataset.md#enabletrading) on `dataset(Dataset.TOKEN)`. [`enableTrading`](../../../reference-api/classes/TokenDataset.md#enabletrading) takes an object of type `Build5Request<`[`EnableTokenTradingRequest`](../../../reference-api/interfaces/EnableTokenTradingRequest.md)`>` as parameter.

```tsx file=../../../../../packages/sdk/examples/token/https/enableTrading.ts#L17-L31
```

[`enableTrading`](../../../reference-api/classes/TokenDataset.md#enabletrading) returns an oject of type [`Token`](../../../reference-api/interfaces/Token.md).

## Full How-To Code

```tsx file=../../../../../packages/sdk/examples/token/https/enableTrading.ts
```
