---
title: Create Auction
tags:
  - how-to
  - auction
  - create
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import DeepLink from '../../_admonitions/_deep_link.md'

The create Auction functionality allows you to run generic auction without or with an asset. Asset can be an NFT. You can also [bid](./bid.md) on an Auction or get more [infos](./get-by-id.md) about a specific Auction.

<Tabs groupId="request-type">
  <TabItem value="otr" label="OTR">
    To create auction, you must call [`create`](../../reference-api/classes/AuctionOtrDataset.md#create) on `dataset(Dataset.AUCTION)`.
    [`create`](../../reference-api/classes/AuctionOtrDataset.md#create) takes an object of type [`AuctionCreateTangleRequest`](../../reference-api/interfaces/AuctionCreateTangleRequest.md) as parameter.

    ```tsx file=../../../../packages/sdk/examples/auction/otr/create.ts#L11-L19
    ```

    [`create`](../../reference-api/classes/AuctionOtrDataset.md#create) returns an oject of type [`OtrRequest`](../../reference-api/classes/DatasetClassOtr.OtrRequest.md)`<`[`AuctionCreateTangleRequest`](../../reference-api/interfaces/AuctionCreateTangleRequest.md)`>`

    <DeepLink/>
    
    The response transaction to your OTR will include an `Auction ID` which others can use to [bid](./bid.md) on your auction or to get more [info](./get-by-id.md) about your Auction. 

  </TabItem>  
  <TabItem value="https" label="HTTPS">
    To create auction, you must call [`create`](../../reference-api/classes/AuctionDataset.md#create) on `dataset(Dataset.AUCTION)`.
    [`create`](../../reference-api/classes/NftDataset.md#create) takes an object of type [`AuctionCreateRequest`](../../reference-api/interfaces/AuctionCreateRequest.md) as parameter.

    ```tsx file=../../../../packages/sdk/examples/auction/https/create.ts#L12-L32
    ```

    You can use the `Auction ID` to [`bid`](./bid.md) on the Auction or get more [`info`](./get-by-id.md) about it.
  </TabItem>
</Tabs>

## Full How-To Code

<Tabs groupId="request-type">
  <TabItem value="otr" label="OTR">
    ```tsx file=../../../../packages/sdk/examples/auction/otr/create.ts
    ```
  </TabItem>  
  <TabItem value="https" label="HTTPS">
    ```tsx file=../../../../packages/sdk/examples/auction/https/create.ts
    ```
  </TabItem>
</Tabs>
