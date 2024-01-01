---
title: Create a Stamp
keywords:
  - how-to
  - create
  - stamp
---

To create a stamp, you must call `create` on `dataset(Dataset.STAMP)`. `create` takes an object of type `Build5Request<`[`CreateMemberRequest`](../../../search-post/interfaces/StampRequest.md)`>` as parameter in which you can specify the file you want to stamp.

```tsx file=../../../../../packages/sdk/examples/create_stamp.ts#L13-L27
```
