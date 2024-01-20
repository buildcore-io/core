---
title: Create a Stamp
tags:
  - how-to
  - create
  - stamp
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
  <TabItem value="otr" label="OTR">
    To create a stamp, you must call `create` on `dataset(Dataset.STAMP)`. `create` takes an object of type [`StampTangleRequest`](../../../search-otr/interfaces/StampTangleRequest.md)` as parameter in which you can specify the uri for the file you want to stamp.

    ```tsx file=../../../../../packages/sdk/examples/stamp/otr/create.ts#L10-L12
    ```
  </TabItem>  
  <TabItem value="https" label="HTTPS">
    To create a stamp, you must call `create` on `dataset(Dataset.STAMP)`. `create` takes an object of type `Build5Request<`[`StampRequest`](../../../search-post/interfaces/StampRequest.md)`>` as parameter in which you can specify the file you want to stamp.

    ```tsx file=../../../../../packages/sdk/examples/stamp/https/create.ts#L13-L27
    ```
  </TabItem>
</Tabs>
