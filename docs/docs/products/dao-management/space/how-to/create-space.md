---
title: Create Space
tags:
  - how-to
  - create
  - space
---

To create a space, you must call `create` on `dataset(Dataset.SPACE)`. In the body, you can specify the name of the space.
`create` takes an object of type `Build5Request<`[`SpaceCreateRequest`](../../../../search-post/interfaces/SpaceCreateRequest.md)`>` as parameter.

:::info

To create a space, don't forget to create a member first

:::

```tsx file=../../../../../../packages/sdk/examples/create_space.ts#L11-L26
```
