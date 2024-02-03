---
title: Bulk Purchase NFTs
tags:
  - how-to
  - purchase
  - nft
  - bulk
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import DeepLink from '../../_admonitions/_deep_link.md'

<Tabs>
  <TabItem value="otr" label="OTR">
    To bulk purchase NFTs, you must call `bulkPurchase` on `dataset(Dataset.NFT)`.
    `bulkPurchase` takes an object of type [`NftPurchaseBulkTangleRequest`](../../reference-api/interfaces/NftPurchaseBulkTangleRequest.md) as parameter.

    ```tsx file=../../../../packages/sdk/examples/nft/otr/bulk_purchase.ts#L12-L14
    ```

    <DeepLink/>
  </TabItem>  
  <TabItem value="https" label="HTTPS">
    To bulk purchase NFTs, you must call `bulkPurchase` on `dataset(Dataset.NFT)`.
    `bulkPurchase` takes an object of type [`NftPurchaseBulkRequest`](../../reference-api/interfaces/NftPurchaseBulkRequest.md) as parameter.

    ```tsx file=../../../../packages/sdk/examples/nft/https/bulk_purchase.ts#L22-L35
    ```
  </TabItem>
</Tabs>
