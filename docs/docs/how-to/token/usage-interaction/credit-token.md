---
title: Credit Token
tags:
  - how-to
  - sale
  - token
---

## Example

To credit token, you must call [`credit`](../../../reference-api/classes/TokenDataset.md#credit) on `dataset(Dataset.TOKEN)`. [`credit`](../../../reference-api/classes/TokenDataset.md#credit) takes an object of type `Build5Request<`[`CreditTokenRequest`](../../../reference-api/interfaces/CreditTokenRequest.md)`>` as parameter.

```tsx file=../../../../../packages/sdk/examples/token/https/credit.ts#L17-L31
```

[`credit`](../../../reference-api/classes/TokenDataset.md#credit) returns an oject of type [`Transaction`](../../../reference-api/interfaces/Transaction.md).

## Full How-To Code

```tsx file=../../../../../packages/sdk/examples/token/https/credit.ts
```
