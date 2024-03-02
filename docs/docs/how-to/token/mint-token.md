---
title: Mint a Token
tags:
  - how-to
  - create
  - token
---

Minting the token creates the token on the specified network. You can mint the token by calling [`mint`](../../reference-api/classes/TokenDataset#mint) on `dataset(Dataset.TOKEN)`. [`mint`](../../reference-api/classes/TokenDataset#mint) takes an object of type `Build5Request<`[`TokenMintRequest`](../../reference-api/interfaces/TokenMintRequest.md)`>` as parameter in which you can specify the token ID and the network where you want the token to be minted.

```tsx file=../../../../packages/sdk/examples/token/https/mint.ts#L17-L31
```

## Full How-To Code

```tsx file=../../../../packages/sdk/examples/token/https/mint.ts
```
