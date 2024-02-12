---
title: Create Auction
tags:
  - how-to
  - auction
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import DeepLink from '../../_admonitions/_deep_link.md'

Auction APIs allows you to run generic auction without or with an asset. Asset can be NFT.

<Tabs>
  <TabItem value="otr" label="OTR">
    To create auction, you must call [`AuctionOtrDataset`](../../reference-api/classes/AuctionOtrDataset.md#create) on `dataset(Dataset.AUCTION)`.
    [`create`](../../reference-api/classes/AuctionOtrDataset.md#create) takes an object of type [`AuctionCreateTangleRequest`](../../reference-api/interfaces/AuctionCreateTangleRequest.md) as parameter.

    ```tsx file=../../../../packages/sdk/examples/auction/otr/create.ts#L4-L47
    ```

    <DeepLink/>
  </TabItem>  
  <TabItem value="https" label="HTTPS">
    To create auction, you must call [`create`](../../reference-api/classes/AuctionDataset.md#create) on `dataset(Dataset.AUCTION)`.
    [`create`](../../reference-api/classes/NftDataset.md#create) takes an object of type [`AuctionCreateRequest`](../../reference-api/interfaces/AuctionCreateRequest.md) as parameter.

    ```tsx file=../../../../packages/sdk/examples/auction/https/create.ts#L6-L63
    ```
  </TabItem>
</Tabs>
