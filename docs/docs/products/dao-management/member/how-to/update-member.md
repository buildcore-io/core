---
title: Update Member
---

To update a member, we first get the member with their ID, which, in this case, is the member's address.

```tsx file=../../../../../../packages/sdk/examples/member/update.ts#L8-L12
```

With the member, we can create a signature and update, for example, the name by calling `update` on `dataset(Dataset.MEMBER)` and passing the new name in the body.

```tsx file=../../../../../../packages/sdk/examples/member/update.ts#L16-L29
```
