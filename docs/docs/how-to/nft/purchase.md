---
title: Purchase NFT
tags:
  - how-to
  - purchase
  - nft
  - otr
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import DeepLink from '../../_admonitions/_deep_link.md'

<Tabs>
  <TabItem value="otr" label="OTR">
    To purchase an NFT, you must call [`purchase`](../../reference-api/classes/NftOtrDataset.md#purchase) on `dataset(Dataset.NFT)`.
    [`purchase`](../../reference-api/classes/NftOtrDataset.md#purchase) takes an object of type [`NftPurchaseTangleRequest`](../../reference-api/interfaces/NftPurchaseTangleRequest.md) as parameter.

    ```tsx file=../../../../packages/sdk/examples/nft/otr/purchase.ts#L12-L14
    ```

    <DeepLink/>

    If you want to track the purchase you can use the [track](../track-otrs.md) how-to.
  </TabItem>  
  <TabItem value="https" label="HTTPS">
    TODO
  </TabItem>
</Tabs>