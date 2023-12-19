---
title: Create NFT Collection
---

To create a NFT collection, you need to call `create` on `dataset(Dataset.NFT_COLLECTION)`. In the body you can specify the name of the collection, the symbol, the base URI and more.

```tsx file=../../../../../packages/sdk/examples/create_nft_collection.ts#L19-L44
```

After that you should create a list of objects which describe the single NFTs, their name, description and image, price and so on.

```tsx file=../../../../../packages/sdk/examples/create_nft_collection.ts#L49-L65
```

And as a last step you can mint the batch of NFTs by calling `createBatch` on `dataset(Dataset.NFT)` and passing the list of NFTs in the body.

```tsx file=../../../../../packages/sdk/examples/create_nft_collection.ts#L67-L78
```
