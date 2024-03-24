---
title: Update Member
tags:
  - how-to
  - update
  - member
---

To update a member, we first get the member with their ID, which, in this case, is the member's address.

```tsx file=../../../../../packages/sdk/examples/member/update.ts#L9-L13
```

With the member, we can create a signature and update, for example, the name by calling [`update`](../../../reference-api/classes/MemberDataset.md#update) on `dataset(Dataset.MEMBER)` and passing the new name in the body.
[`update`](../../../reference-api/classes/MemberDataset.md#update) takes an object of type [`Build5Request`](../../../reference-api/interfaces/Build5Request)`<`[`MemberUpdateRequest`](../../../reference-api/interfaces/MemberUpdateRequest.md)`>` as parameter.

```tsx file=../../../../../packages/sdk/examples/member/update.ts#L17-L30
```

[`update`](../../../reference-api/classes/MemberDataset.md#update) returns an oject of type [`Member`](../../../reference-api/interfaces/Member.md).

## Full How-To Code

```tsx file=../../../../../packages/sdk/examples/member/update.ts
```
