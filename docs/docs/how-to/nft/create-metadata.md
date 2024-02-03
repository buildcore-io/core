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

<Tabs>
  <TabItem value="otr" label="OTR">
    To create a NFT with Metadata, you must call `mintMetadataNft` on `dataset(Dataset.NFT)`. `mintMetadataNft` takes an object of type [`MintMetadataNftTangleRequest`](../../reference-api/interfaces/MintMetadataNftTangleRequest.md) as parameter. In there you can specify the metadata of the NFT which for example could be used to create a digital twin.

    ```tsx file=../../../../packages/sdk/examples/nft/otr/nft.metadata.otr.ts#L6-L10
    ```

    <DeepLink/>
  </TabItem>  
  <TabItem value="https" label="HTTPS">
    To create a NFT with Metadata, you must call `mintMetadata` on `dataset(Dataset.NFT)`. `mintMetadata` takes an object of type [`MintMetadataNftRequest`](../../reference-api/interfaces/MintMetadataNftRequest.md) as parameter. In there you can specify the metadata of the NFT which for example could be used to create a digital twin.

    ```tsx file=../../../../packages/sdk/examples/nft/https/nft.metadata.ts#L6-L117
    ```
  </TabItem>
</Tabs>
