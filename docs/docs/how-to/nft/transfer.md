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

<Tabs groupId="request-type">
  <TabItem value="otr" label="OTR">
    To transfer NFTs, you must call [`transfer`](../../reference-api/classes/NftOtrDataset.md#transfer) on `dataset(Dataset.NFT)`.
    [`transfer`](../../reference-api/classes/NftOtrDataset.md#transfer) takes an object of type [`NftTransferTangleRequest`](../../reference-api/interfaces/NftTransferTangleRequest.md) as parameter.

    ```tsx file=../../../../packages/sdk/examples/nft/otr/transfer.ts#L9-L16
    ```

    [`transfer`](../../reference-api/classes/NftOtrDataset.md#transfer) returns an oject of type [`OtrRequest`](../../reference-api/classes/DatasetClassOtr.OtrRequest.md)`<`[`NftTransferTangleRequest`](../../reference-api/interfaces/NftTransferTangleRequest.md)`>`.

    <DeepLink/>
  </TabItem>  
  <TabItem value="https" label="HTTPS">
    To transfer NFTs, you must call [`transfer`](../../reference-api/classes/NftDataset.md#transfer) on `dataset(Dataset.NFT)`.
    [`transfer`](../../reference-api/classes/NftDataset.md#transfer) takes an object of type [`NftTransferRequest`](../../reference-api/interfaces/NftTransferRequest.md) as parameter.

    ```tsx file=../../../../packages/sdk/examples/nft/https/transfer.ts#L19-L35
    ```

    [`transfer`](../../reference-api/classes/NftDataset.md#transfer) returns an map of transfered NFT IDs and there status/error code.
  </TabItem>
</Tabs>

## Full How-To Code

<Tabs groupId="request-type">
  <TabItem value="otr" label="OTR">
    ```tsx file=../../../../packages/sdk/examples/nft/otr/transfer.ts
    ```
  </TabItem>  
  <TabItem value="https" label="HTTPS">
    ```tsx file=../../../../packages/sdk/examples/nft/https/transfer.ts
    ```
  </TabItem>
</Tabs>
