---
title: Create NFT with Metadata
tags:
  - how-to
  - create
  - nft
  - metadata
  - digital twin
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import DeepLink from '../../_admonitions/_deep_link.md'

<Tabs groupId="request-type">
  <TabItem value="otr" label="OTR">
    To create a NFT with Metadata, you must call [`mintMetadataNft`](../../reference-api/classes/NftOtrDataset.md#mintmetadatanft) on `dataset(Dataset.NFT)`. [`mintMetadataNft`](../../reference-api/classes/NftOtrDataset.md#mintmetadatanft) takes an object of type [`MintMetadataNftTangleRequest`](../../reference-api/interfaces/MintMetadataNftTangleRequest.md) as parameter. In there you can specify the metadata of the NFT which for example could be used to create a digital twin.

    ```tsx file=../../../../packages/sdk/examples/nft/otr/metadata.ts#L6-L10
    ```

    [`mintMetadataNft`](../../reference-api/classes/NftOtrDataset.md#mintmetadatanft) returns an oject of type [`OtrRequest`](../../reference-api/classes/DatasetClassOtr.OtrRequest.md)`<`[`MintMetadataNftTangleRequest`](../../reference-api/interfaces/MintMetadataNftTangleRequest.md)`>`.

    <DeepLink/>
  </TabItem>  
  <TabItem value="https" label="HTTPS">
    To create a NFT with Metadata, you must call [`mintMetadata`](../../reference-api/classes/NftDataset.md#mintmetadata) on `dataset(Dataset.NFT)`. [`mintMetadata`](../../reference-api/classes/NftDataset.md#mintmetadata) takes an object of type [`MintMetadataNftRequest`](../../reference-api/interfaces/MintMetadataNftRequest.md) as parameter. In there you can specify the metadata of the NFT which for example could be used to create a digital twin.

    ```tsx file=../../../../packages/sdk/examples/nft/https/metadata.ts#L19-L33
    ```

    [`mintMetadata`](../../reference-api/classes/NftDataset.md#mintmetadata) returns an oject of type [`Transaction`](../../reference-api/interfaces/Transaction.md).
  </TabItem>
</Tabs>

## Full How-To Code

<Tabs groupId="request-type">
  <TabItem value="otr" label="OTR">
    ```tsx file=../../../../packages/sdk/examples/nft/otr/metadata.ts
    ```
  </TabItem>  
  <TabItem value="https" label="HTTPS">
    ```tsx file=../../../../packages/sdk/examples/nft/https/metadata.ts
    ```
  </TabItem>
</Tabs>
