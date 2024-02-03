---
title: Transfer NFTs
tags:
  - how-to
  - transfer
  - nft
  - bulk
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import DeepLink from '../../_admonitions/_deep_link.md'

<Tabs>
  <TabItem value="otr" label="OTR">
    To transfer NFTs, you must call `transfer` on `dataset(Dataset.NFT)`.
    `transfer` takes an object of type [`NftTransferTangleRequest`](../../reference-api/interfaces/NftTransferTangleRequest.md) as parameter.

    ```tsx file=../../../../packages/sdk/examples/nft/otr/transfer.ts#L9-L16
    ```

    <DeepLink/>
  </TabItem>  
  <TabItem value="https" label="HTTPS">
    To transfer NFTs, you must call `transfer` on `dataset(Dataset.NFT)`.
    `transfer` takes an object of type [`NftTransferRequest`](../../reference-api/interfaces/NftTransferRequest.md) as parameter.

    ```tsx file=../../../../packages/sdk/examples/nft/https/transfer.ts#L19-L35
    ```
  </TabItem>
</Tabs>
