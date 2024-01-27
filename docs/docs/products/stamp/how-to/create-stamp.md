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
    To create a stamp, you must call `create` on `dataset(Dataset.STAMP)`. `create` takes an object of type [`StampTangleRequest`](../../../reference-api/interfaces/StampTangleRequest.md) as parameter in which you can specify the uri for the file you want to stamp.

    ```tsx file=../../../../../packages/sdk/examples/stamp/otr/create.ts#L10-L12
    ```

:::info Days Parameter

When you create a stamp, you can specify the number of days the stamp should be valid. If the OTR contains more funds as needed, the remaining funds will be returned. If you don't specify the number of days, the stamp will be valid for whatever you paid for in the OTR.

:::
  </TabItem>  
  <TabItem value="https" label="HTTPS">
    To create a stamp, you must call `create` on `dataset(Dataset.STAMP)`. `create` takes an object of type `Build5Request<`[`StampRequest`](../../../reference-api/interfaces/StampRequest.md)`>` as parameter in which you can specify the file you want to stamp.

    ```tsx file=../../../../../packages/sdk/examples/stamp/https/create.ts#L13-L27
    ```
  </TabItem>
</Tabs>
