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

<Tabs groupId="request-type">
  <TabItem value="otr" label="OTR">
    To bulk purchase NFTs, you must call [`bulkPurchase`](../../reference-api/classes/NftOtrDataset.md#bulkpurchase) on `dataset(Dataset.NFT)`.
    [`bulkPurchase`](../../reference-api/classes/NftOtrDataset.md#bulkpurchase) takes an object of type [`NftPurchaseBulkTangleRequest`](../../reference-api/interfaces/NftPurchaseBulkTangleRequest.md) as parameter.

    ```tsx file=../../../../packages/sdk/examples/nft/otr/bulk_purchase.ts#L12-L14
    ```

    [`bulkPurchase`](../../reference-api/classes/NftOtrDataset.md#bulkpurchase) returns an oject of type [`OtrRequest`](../../reference-api/classes/DatasetClassOtr.OtrRequest.md)`<`[`NftPurchaseBulkRequest`](../../reference-api/interfaces/NftPurchaseBulkRequest.md)`>`

    <DeepLink/>
  </TabItem>  
  <TabItem value="https" label="HTTPS">
    To bulk purchase NFTs, you must call [`bulkPurchase`](../../reference-api/classes/NftDataset.md#bulkpurchase) on `dataset(Dataset.NFT)`.
    [`bulkPurchase`](../../reference-api/classes/NftDataset.md#bulkpurchase) takes an object of type [`NftPurchaseBulkRequest`](../../reference-api/interfaces/NftPurchaseBulkRequest.md) as parameter.

    ```tsx file=../../../../packages/sdk/examples/nft/https/bulk_purchase.ts#L22-L35
    ```
  </TabItem>
</Tabs>

## Full How-To Code

<Tabs groupId="request-type">
  <TabItem value="otr" label="OTR">
    ```tsx file=../../../../packages/sdk/examples/nft/otr/bulk_purchase.ts
    ```
  </TabItem>  
  <TabItem value="https" label="HTTPS">
    ```tsx file=../../../../packages/sdk/examples/nft/https/bulk_purchase.ts
    ```
  </TabItem>
</Tabs>
