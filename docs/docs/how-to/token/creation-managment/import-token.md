---
title: Import Token
description: How to import a token minted outside of the build.5 platform
tags:
  - how-to
  - import
  - token
---

## Example

To import your token that was minted on the L1 outside of a verse, you must call [`importMintedToken`](../../../reference-api/classes/TokenDataset.md#importmintedtoken) on `dataset(Dataset.TOKEN)`. [`importMintedToken`](../../../reference-api/classes/TokenDataset.md#importmintedtoken) takes an object of type `Build5Request<`[`ImportMintedTokenRequest`](../../../reference-api/interfaces/ImportMintedTokenRequest.md)`>` as parameter.

```tsx file=../../../../../packages/sdk/examples/token/https/import.ts#L17-L32
```

[`importMintedToken`](../../../reference-api/classes/TokenDataset.md#importmintedtoken) returns an oject of type [`Transaction`](../../../reference-api/interfaces/Transaction.md).

## Full How-To Code

```tsx file=../../../../../packages/sdk/examples/token/https/import.ts
```
