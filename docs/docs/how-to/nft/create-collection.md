---
title: Create NFT Collection
tags:
  - how-to
  - create
  - nft
  - collection
  - nft-collection
---

To create a NFT collection, you must call [`create`](../../reference-api/classes/CollectionDataset.md#create) on `dataset(Dataset.COLLECTION)`. In the body, you can specify the collection's name, the symbol, the base URI, and more.
[`create`](../../reference-api/classes/CollectionDataset.md#create) takes an object of type [`BuildcoreRequest`](../../reference-api/interfaces/BuildcoreRequest)`<`[`CreateCollectionRequest`](../../reference-api/interfaces/CreateCollectionRequest.md)`>` as parameter.

```tsx file=../../../../packages/sdk/examples/nft/https/create_collection.ts#L18-L42

```

:::tip Space

If you want to add the collection to a space you can just specify it with the `space` property in the `CreateCollectionRequest` object.

:::
:::tip Royalties Space

If you want to specify royality fees you can set the `royaltiesFee` property and specify a `royalitySpace` in the `CreateCollectionRequest` object.

:::
:::info Validated Address in Space

Make sure the `royaltiesSpace`and `space` you specify have a [validated address](../dao-management/space/validate-address.md)

:::

After that, you should create a list of objects that describe the single NFTs, their name, description and image, price, and so on.

```tsx file=../../../../packages/sdk/examples/nft/https/create_collection.ts#L47-L63

```

As a last step, you can mint the batch of NFTs by calling [`createBatch`](../../reference-api/classes/NftDataset.md#createbatch) on `dataset(Dataset.NFT)` and passing the list of NFTs in the body.
[`createBatch`](../../reference-api/classes/NftDataset.md#createbatch) takes an object of type [`BuildcoreRequest`](../../reference-api/interfaces/BuildcoreRequest)`<`[`NftCreateRequest`](../../reference-api/interfaces/NftCreateRequest.md)`[]>` as parameter.

```tsx file=../../../../packages/sdk/examples/nft/https/create_collection.ts#L65-L76

```

[`createBatch`](../../reference-api/classes/NftDataset.md#createbatch) returns an oject of type [`Collection`](../../reference-api/interfaces/Collection.md).

## Full How-To Code

```tsx file=../../../../packages/sdk/examples/nft/https/create_collection.ts

```
