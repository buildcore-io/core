---
title: Update Member
tags:
  - how-to
  - update
  - member
---

To update a member, we first get the member with their ID, which, in this case, is the member's address.

```tsx file=../../../../../../packages/sdk/examples/member/update.ts#L9-L13
```

With the member, we can create a signature and update, for example, the name by calling `update` on `dataset(Dataset.MEMBER)` and passing the new name in the body.
`update` takes an object of type `Build5Request<`[`MemberUpdateRequest`](../../../../search-post/interfaces/MemberUpdateRequest.md)`>` as parameter.

```tsx file=../../../../../../packages/sdk/examples/member/update.ts#L17-L30
```
