---
title: Mint a Token
tags:
  - how-to
  - create
  - token
---

Minting the token creates the token on the specified network. You can mint the token by calling [`mint`](../../../reference-api/classes/TokenDataset#mint) on `dataset(Dataset.TOKEN)`. [`mint`](../../../reference-api/classes/TokenDataset#mint) takes an object of type `Build5Request<`[`TokenMintRequest`](../../../reference-api/interfaces/TokenMintRequest.md)`>` as parameter in which you can specify the token ID and the network where you want to mint the token.

```tsx file=../../../../../packages/sdk/examples/token/https/mint.ts#L17-L31
```

[`mint`](../../../reference-api/classes/TokenDataset#mint) returns an oject of type [`Transaction`](../../../reference-api/interfaces/Transaction.md).

## Full How-To Code

```tsx file=../../../../../packages/sdk/examples/token/https/mint.ts
```
