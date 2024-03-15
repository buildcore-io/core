---
title: Update Space
tags:
  - how-to
  - update
  - space
---

To update a Space, we first as an example get the first space of our member.

```tsx file=../../../../../packages/sdk/examples/space/update.ts#L9-L15
```

:::info Update a Space as Guardian

You can only update Spaces where you are a Guardian

:::

With the space ID and Guardian member we can create a signature and update, for example, the name by calling [`update`](../../../reference-api/classes/SpaceDataset.md#update) on `dataset(Dataset.SPACE)` and passing the new name in the body.
[`update`](../../../reference-api/classes/SpaceDataset.md#update) takes an object of type [`Build5Request`](../../../reference-api/interfaces/Build5Request)`<`[`SpaceUpdateRequest`](../../../reference-api/interfaces/SpaceUpdateRequest.md)`>` as parameter.

```tsx file=../../../../../packages/sdk/examples/space/update.ts#L19-L33
```

[`update`](../../../reference-api/classes/SpaceDataset.md#update) returns an oject of type [`Proposal`](../../../reference-api/interfaces/Proposal.md).
