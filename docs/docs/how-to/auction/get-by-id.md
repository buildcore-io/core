---
title: Get Auction by ID
tags:
  - how-to
  - auction
  - get
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

To get more infos about a specific auction you can find the auction by ID and get info like highest bid, highest bidder and more.

:::info Get Auctions

If you are interested in getting Auctions by other filters, have a loot at the [get](./get.md) how-tos.

:::

<Tabs groupId="request-type">
  <TabItem value="https" label="HTTPS">
    To get infos about a specific Auction, you must call [`id`](../../reference-api/classes/DatasetClass.md#id) on `dataset(Dataset.AUCTION)` followed by a `get()`.
    [`id`](../../reference-api/classes/DatasetClass.md#id) takes an object of type [`AuctionBidRequest`](../../reference-api/interfaces/AuctionBidRequest.md) as parameter.

    ```tsx file=../../../../packages/sdk/examples/auction/https/get_by_id.ts#L11-L15
    ```
  </TabItem>
</Tabs>

:::info Auction Info

If you are interested about more details about a specific auction, you can check out [this](./get-by-id.md) how-to.

:::

## Full How-To Code

```tsx file=../../../../packages/sdk/examples/auction/https/get_by_id.ts
```
