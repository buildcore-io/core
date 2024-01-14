---
title: Get Member
tags:
  - how-to
  - get
  - member
---

To get one or multiple members there are multiple way. This how-to will list and explain them.

:::tip

All those functions also have a `Live` function which returns an `Observable` you can listen to. Just append `Live` to the function name.

:::

## Get By Field

You need to call `getByField`. `getByField` takes a `string` as `fieldName` and the value you want to look for as `fieldValue`.

```tsx file=../../../../../../packages/sdk/examples/member/get.ts#L9-L12
```

## Get By Space

You need to call `getBySpace`. `getBySpace` takes a `string` as `space` id and an optional `startAfter` TODO.

```tsx file=../../../../../../packages/sdk/examples/member/get.ts#L16-L19
```

## Get All Updated After

You need to call `getAllUpdatedAfter`. `getAllUpdatedAfter` takes a TODO.

```tsx file=../../../../../../packages/sdk/examples/member/get.ts#L23-L26
```

## Get Many By Id

You need to call `getManyById`. `getManyById` takes a list of IDs as `string`.

```tsx file=../../../../../../packages/sdk/examples/member/get.ts#L31-L34
```
