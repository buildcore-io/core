---
title: Create NFT Collection
tags:
  - how-to
  - create
  - nft
  - collection
  - nft-collection
---

To create a NFT collection, you must call `create` on `dataset(Dataset.NFT_COLLECTION)`. In the body, you can specify the collection's name, the symbol, the base URI, and more.
`create` takes an object of type `Build5Request<`[`CreateCollectionRequest`](../../../reference-api/interfaces/CreateCollectionRequest.md)`>` as parameter.

```tsx file=../../../../../packages/sdk/examples/nft/https/create_collection.ts#L18-L43
```
:::tip Space

If you want to add the collection to a space you can just specify it with the `space` property in the `CreateCollectionRequest` object.

:::
:::tip Royalties Space

If you want to specify royality fees you can set the `royaltiesFee` property and specify a `royalitySpace` in the `CreateCollectionRequest` object.

:::
:::info Validated Address in Space

Make sure the `royaltiesSpace`and `space` you specify have a [validated address](../../dao-management/space/how-to/validate-address.md)

:::

After that, you should create a list of objects that describe the single NFTs, their name, description and image, price, and so on.

```tsx file=../../../../../packages/sdk/examples/nft/https/create_collection.ts#L49-L64
```

As a last step, you can mint the batch of NFTs by calling `createBatch` on `dataset(Dataset.NFT)` and passing the list of NFTs in the body.
`createBatch` takes an object of type `Build5Request<`[`NftCreateRequest`](../../../reference-api/interfaces/NftCreateRequest.md)`[]>` as parameter.

```tsx file=../../../../../packages/sdk/examples/nft/https/create_collection.ts#L66-L77
```
