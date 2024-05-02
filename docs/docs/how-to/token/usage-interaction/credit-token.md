---
title: Credit Token
description: How to credit token
tags:
  - how-to
  - sale
  - token
---

## About Crediting Token

You can use the `credit` functionality if you change your opinion about a trade you made. For example, if you want to buy Token XY with 100 SMR, but later in the `cooldown` phase, if you decide you want to buy less, then you can credit yourself 30 SMR, and after the `cooldown` phase, you will get 70 SMR worth of XY token.

## Example

To credit a token, you must call [`credit`](../../../reference-api/classes/TokenDataset.md#credit) on `dataset(Dataset.TOKEN)`. [`credit`](../../../reference-api/classes/TokenDataset.md#credit) takes an object of type `BuildcoreRequest<`[`CreditTokenRequest`](../../../reference-api/interfaces/CreditTokenRequest.md)`>` as parameter.

```tsx file=../../../../../packages/sdk/examples/token/https/credit.ts#L17-L31

```

[`credit`](../../../reference-api/classes/TokenDataset.md#credit) returns an oject of type [`Transaction`](../../../reference-api/interfaces/Transaction.md).

## Full How-To Code

```tsx file=../../../../../packages/sdk/examples/token/https/credit.ts

```
