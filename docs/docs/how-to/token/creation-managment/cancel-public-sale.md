---
title: Cancel Public Sale
description: How to cancel a public token sale
tags:
  - how-to
  - sale
  - token
---

## Example

To cancel a public token sale, you must call [`cancelPublicSale`](../../../reference-api/classes/TokenDataset.md#cancelpublicsale) on `dataset(Dataset.TOKEN)`. [`cancelPublicSale`](../../../reference-api/classes/TokenDataset.md#cancelpublicsale) takes an object of type `BuildcoreRequest<`[`CanelPublicSaleRequest`](../../../reference-api/interfaces/CanelPublicSaleRequest.md)`>` as parameter where you can specify the token ID of the sale you want to cancel.

```tsx file=../../../../../packages/sdk/examples/token/https/cancelSale.ts#L17-L30

```

[`cancelPublicSale`](../../../reference-api/classes/TokenDataset.md#cancelpublicsale) returns an oject of type [`Token`](../../../reference-api/interfaces/Token.md).

## Full How-To Code

```tsx file=../../../../../packages/sdk/examples/token/https/cancelSale.ts

```
