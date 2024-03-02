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

<Tabs groupId="request-type">
  <TabItem value="otr" label="OTR">
    To purchase an NFT, you must call [`purchase`](../../reference-api/classes/NftOtrDataset.md#purchase) on `dataset(Dataset.NFT)`.
    [`purchase`](../../reference-api/classes/NftOtrDataset.md#purchase) takes an object of type [`NftPurchaseTangleRequest`](../../reference-api/interfaces/NftPurchaseTangleRequest.md) as parameter.

    ```tsx file=../../../../packages/sdk/examples/nft/otr/purchase.ts#L12-L14
    ```

    [`purchase`](../../reference-api/classes/NftOtrDataset.md#purchase) returns an oject of type [`OtrRequest`](../../reference-api/classes/DatasetClassOtr.OtrRequest.md)`<`[`NftPurchaseTangleRequest`](../../reference-api/interfaces/NftPurchaseTangleRequest.md)`>`.

    <DeepLink/>

    If you want to track the purchase you can use the [track](../track-otrs.md) how-to.
  </TabItem>  
  <TabItem value="https" label="HTTPS">
    TODO
  </TabItem>
</Tabs>

## Full How-To Code

```tsx file=../../../../packages/sdk/examples/nft/otr/purchase.ts
```
