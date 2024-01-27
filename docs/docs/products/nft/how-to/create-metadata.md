---
title: Create NFT with Metadata
tags:
  - how-to
  - create
  - nft
  - metadata
  - digital twin
---

To create a NFT with Metadata, you must call `mintMetadataNft` on `dataset(Dataset.NFT)`. `mintMetadataNft` takes an object of type [`MintMetadataNftTangleRequest`](../../../reference-api/interfaces/MintMetadataNftTangleRequest.md) as parameter. In there you can specify the metadata of the NFT which for example could be used to create a digital twin.

```tsx file=../../../../../packages/sdk/examples/nft/otr/metadata.ts#L6-L10
```
