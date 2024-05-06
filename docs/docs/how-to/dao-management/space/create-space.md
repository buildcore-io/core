---
title: Create Space
tags:
  - how-to
  - create
  - space
---

To create a space, you must call [`create`](../../../reference-api/classes/SpaceDataset.md#create) on `dataset(Dataset.SPACE)`. In the body, you can specify the name of the space.
[`create`](../../../reference-api/classes/SpaceDataset.md#create) takes an object of type [`BuildcoreRequest`](../../../reference-api/interfaces/BuildcoreRequest)`<`[`SpaceCreateRequest`](../../../reference-api/interfaces/SpaceCreateRequest.md)`>` as parameter.

:::info Create a Member first

To create a space, don't forget to create a member first

:::

```tsx file=../../../../../packages/sdk/examples/space/create.ts#L11-L26

```

[`create`](../../../reference-api/classes/SpaceDataset.md#create) returns an oject of type [`Space`](../../../reference-api/interfaces/Space.md).

## Full How-To Code

```tsx file=../../../../../packages/sdk/examples/space/create.ts

```
