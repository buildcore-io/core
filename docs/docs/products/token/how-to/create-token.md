---
title: Create a Token
tags:
  - how-to
  - create
  - token
---

To create a token, you must call [`create`](../../../reference-api/classes/TokenDataset#create) on `dataset(Dataset.TOKEN)`. [`create`](../../../reference-api/classes/TokenDataset#create) takes an object of type `Build5Request<`[`TokenCreate`](../../../reference-api/interfaces/TokenCreateRequest.md)`>` as parameter in which you can specify things like the token name, decimals, symbol, allocations and more.

```tsx file=../../../../../packages/sdk/examples/token/https/create.ts#L17-L48
```
