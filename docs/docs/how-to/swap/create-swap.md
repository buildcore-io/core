---
title: Create Swap
tags:
  - how-to
  - swap
  - nft
  - token
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import DeepLink from '../../_admonitions/_deep_link.md'

<Tabs groupId="request-type">
  <TabItem value="otr" label="OTR">
    To create a swap order, you must call [`create`](../../reference-api/classes/SwapOtrDataset.md#create) on `dataset(Dataset.SWAP)`.
    [`create`](../../reference-api/classes/SwapOtrDataset.md#create) takes an object of type [`SwapCreateTangleRequest`](../../reference-api/interfaces/SwapCreateTangleRequest.md) as parameter, in which you can specify the recipient, native tokens, NFTs and base token you are interested in.

    ```tsx file=../../../../packages/sdk/examples/swap/otr/create.ts#L21-L27
    ```

    [`create`](../../reference-api/classes/SwapOtrDataset.md#create) returns an oject of type [`OtrRequest`](../../reference-api/classes/DatasetClassOtr.OtrRequest.md)`<`[`SwapCreateTangleRequest`](../../reference-api/interfaces/SwapCreateTangleRequest.md)`>`

    <DeepLink/>
  </TabItem>  
  <TabItem value="https" label="HTTPS">
    To create a swap order, you must call [`create`](../../reference-api/classes/SwapDataset.md#create) on `dataset(Dataset.SWAP)`.
    [`create`](../../reference-api/classes/SwapDataset.md#create) takes an object of type [`SwapCreateRequest`](../../reference-api/interfaces/SwapCreateRequest.md) as parameter, in which you can specify the recipient, native tokens, NFTs and base token you are interested in.

    ```tsx file=../../../../packages/sdk/examples/swap/https/create.ts#L14-L29
    ```

    afterwards you need to fund a specific address:

    ```tsx file=../../../../packages/sdk/examples/swap/https/create.ts#L31
    ```

    and set the order as funded:

    ```tsx file=../../../../packages/sdk/examples/swap/https/create.ts#L35-L46
    ```
    
  </TabItem>
</Tabs>

:::info setFunded

With `setFunded`, you can specify if you, as the bidder, are giving your final bid or keeping it open.

:::

## Full How-To Code

<Tabs groupId="request-type">
  <TabItem value="otr" label="OTR">
    ```tsx file=../../../../packages/sdk/examples/swap/otr/create.ts
    ```
  </TabItem>  
  <TabItem value="https" label="HTTPS">
    ```tsx file=../../../../packages/sdk/examples/swap/https/create.ts
    ```
  </TabItem>
</Tabs>
