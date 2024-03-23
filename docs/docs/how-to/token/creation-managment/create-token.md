---
title: Create a Token
description: How to create a token on the build.5 platform
tags:
  - how-to
  - create
  - token
---

## About Creating Tokens

Creating a token lets you specify all the details around your token, like name, links, sale info, and more. To generate the token on L1, you must call [mint](./mint-token.md).

## Example

To create a token, you must call [`create`](../../../reference-api/classes/TokenDataset.md#create) on `dataset(Dataset.TOKEN)`. [`create`](../../../reference-api/classes/TokenDataset.md#create) takes an object of type `Build5Request<`[`TokenCreateRequest`](../../../reference-api/interfaces/TokenCreateRequest.md)`>` as parameter in which you can specify things like the token name, decimals, symbol, allocations and more.

```tsx file=../../../../../packages/sdk/examples/token/https/create.ts#L17-L48
```

[`create`](../../../reference-api/classes/TokenDataset#create) returns an oject of type [`Token`](../../../reference-api/interfaces/Token.md).

## Full How-To Code

```tsx file=../../../../../packages/sdk/examples/token/https/create.ts
```
