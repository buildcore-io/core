---
title: Stake Token
description: How to stake token
tags:
  - how-to
  - staking
  - token
---

import DeepLink from '../../../_admonitions/_deep_link.md'

## About Credit Token

The credit token functionality is for cases where you want to request your funds back because you, for example, sent an incorrect amount of funds.

## Example

To stake a token, you must call [`stake`](../../../reference-api/classes/TokenOtrDataset.md#stake) on `dataset(Dataset.TOKEN)`. [`stake`](../../../reference-api/classes/TokenOtrDataset.md#stake) takes an object of type `Build5Request<`[`TokenStakeTangleRequest`](../../../reference-api/interfaces/TokenStakeTangleRequest.md)`>` as parameter.

```tsx file=../../../../../packages/sdk/examples/token/otr/stake.ts#L9-L13
```

<DeepLink/>

## Full How-To Code

```tsx file=../../../../../packages/sdk/examples/token/otr/stake.ts
```
