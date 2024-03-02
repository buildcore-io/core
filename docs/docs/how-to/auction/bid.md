---
title: Bid on Auction
tags:
  - how-to
  - auction
  - bid
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import DeepLink from '../../_admonitions/_deep_link.md'

You can bid on any auction. The only thing you need is an `Auction ID` and the funds you want to use for your bid.

<Tabs groupId="request-type">
  <TabItem value="otr" label="OTR">
    To bid on an Auction, you must call [`bid`](../../reference-api/classes/AuctionOtrDataset.md#bid) on `dataset(Dataset.AUCTION)`.
    [`bid`](../../reference-api/classes/AuctionOtrDataset.md#bid) takes an object of type [`AuctionBidTangleRequest`](../../reference-api/interfaces/AuctionBidTangleRequest.md) as parameter.

    ```tsx file=../../../../packages/sdk/examples/auction/otr/bid.ts#L11-L13
    ```

    [`bid`](../../reference-api/classes/AuctionOtrDataset.md#bid) returns an oject of type [`OtrRequest`](../../reference-api/classes/DatasetClassOtr.OtrRequest.md)`<`[`AuctionBidTangleRequest`](../../reference-api/interfaces/AuctionBidTangleRequest.md)`>`.

    <DeepLink/>
    
    With the Deeplink you can then send your bid assets for the auction.
  </TabItem>  
  <TabItem value="https" label="HTTPS">
    To bid on an Auction, you must call [`bid`](../../reference-api/classes/AuctionDataset.md#bid) on `dataset(Dataset.AUCTION)`.
    [`bid`](../../reference-api/classes/AuctionDataset.md#bid) takes an object of type [`AuctionBidRequest`](../../reference-api/interfaces/AuctionBidRequest.md) as parameter.

    ```tsx file=../../../../packages/sdk/examples/auction/https/bid.ts#L11-L22
    ```

    [`bid`](../../reference-api/classes/AuctionDataset.md#bid) returns an oject of type [`Transaction`](../../reference-api/interfaces/Transaction.md).
  </TabItem>
</Tabs>

:::info Auction Info

If you are interested in more details about a specific auction, you can check out [this](./get-by-id.md) how-to.

:::

## Full How-To Code

<Tabs groupId="request-type">
  <TabItem value="otr" label="OTR">
    ```tsx file=../../../../packages/sdk/examples/auction/otr/bid.ts
    ```
  </TabItem>  
  <TabItem value="https" label="HTTPS">
    ```tsx file=../../../../packages/sdk/examples/auction/https/bid.ts
    ```
  </TabItem>
</Tabs>
