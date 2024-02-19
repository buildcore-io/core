---
title: Get
tags:
  - how-to
  - get
---

There are some get-functions that are applicable to basically all types like members, token and so on.
This how-to will list and explain them. We will use members as an example.

:::tip Live listeners

All those functions also have a `Live` function, which returns an `Observable` you can listen to. Just append `Live` to the function name.

:::
:::tip Pagination

Most of the functions have an optional `startAfter` parameter. You can use this parameter for pagination. You can pass, for example, the `uid` of the last member you received to get to the next page.

:::

## Get By Field

You need to call [`getByField`](../reference-api/classes/DatasetClass.md#getbyfield). [`getByField`](../reference-api/classes/DatasetClass.md#getbyfield) takes a `string` as `fieldName` and the value you want to look for as `fieldValue`.

```tsx file=../../../packages/sdk/examples/member/get.ts#L9-L12
```

## Get By Space

You need to call [`getBySpace`](../reference-api/classes/DatasetClass.md#getbyspace). [`getBySpace`](../reference-api/classes/DatasetClass.md#getbyspace) takes a `string` as `space` id.

```tsx file=../../../packages/sdk/examples/member/get.ts#L16-L19
```

## Get All Updated After

You need to call [`getAllUpdatedAfter`](../reference-api/classes/DatasetClass.md#getallupdatedafter). [`getAllUpdatedAfter`](../reference-api/classes/DatasetClass.md#getallupdatedafter) takes a unix timestamp. The results will contain all members updated after this timestamp.

```tsx file=../../../packages/sdk/examples/member/get.ts#L23-L26
```

## Get Many By Id

You need to call [`getManyById`](../reference-api/classes/DatasetClass.md#getmanybyid). [`getManyById`](../reference-api/classes/DatasetClass.md#getmanybyid) takes a list of IDs as `string`.

```tsx file=../../../packages/sdk/examples/member/get.ts#L31-L34
```

## Get Top

You need to call `getTop`. `getTop` takes an optional limit to for example only get the top 3 members.

```tsx file=../../../packages/sdk/examples/member/get.ts#L37-L40
```
