---
title: Get Member
tags:
  - how-to
  - get
  - member
---

You can use different functions depending on your needs to get one or multiple members. This how-to will list and explain them.

:::tip Live listeners

All those functions also have a `Live` function, which returns an `Observable` you can listen to. Just append `Live` to the function name.

:::
:::tip Pagination

Most of the functions have an optional `startAfter` parameter. You can use this parameter for pagination. You can pass, for example, the `uid` of the last member you received to get to the next page.

:::

## Get By Field

You need to call `getByField`. `getByField` takes a `string` as `fieldName` and the value you want to look for as `fieldValue`.

```tsx file=../../../../../../packages/sdk/examples/member/get.ts#L9-L12
```

## Get By Space

You need to call `getBySpace`. `getBySpace` takes a `string` as `space` id.

```tsx file=../../../../../../packages/sdk/examples/member/get.ts#L16-L19
```

## Get All Updated After

You need to call `getAllUpdatedAfter`. `getAllUpdatedAfter` takes a unix timestamp. The results will contain all members updated after this timestamp.

```tsx file=../../../../../../packages/sdk/examples/member/get.ts#L23-L26
```

## Get Many By Id

You need to call `getManyById`. `getManyById` takes a list of IDs as `string`.

```tsx file=../../../../../../packages/sdk/examples/member/get.ts#L31-L34
```
