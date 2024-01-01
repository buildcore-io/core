---
title: Create NFT Collection
keywords:
  - how-to
  - create
  - nft
  - collection
  - nft-collection
---

To create a NFT collection, you must call `create` on `dataset(Dataset.NFT_COLLECTION)`. In the body, you can specify the collection's name, the symbol, the base URI, and more.
`create` takes an object of type `Build5Request<`[`CreateCollectionRequest`](../../../search-post/interfaces/CreateCollectionRequest.md)`>` as parameter.

```tsx file=../../../../../packages/sdk/examples/create_nft_collection.ts#L19-L44
```

After that, you should create a list of objects that describe the single NFTs, their name, description and image, price, and so on.

```tsx file=../../../../../packages/sdk/examples/create_nft_collection.ts#L49-L65
```

As a last step, you can mint the batch of NFTs by calling `createBatch` on `dataset(Dataset.NFT)` and passing the list of NFTs in the body.
`createBatch` takes an object of type `Build5Request<`[`NftCreateRequest`](../../../search-post/interfaces/NftCreateRequest.md)`[]>` as parameter.

```tsx file=../../../../../packages/sdk/examples/create_nft_collection.ts#L67-L78
```
