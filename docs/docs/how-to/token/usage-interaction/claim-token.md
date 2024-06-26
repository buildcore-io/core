---
title: Claim Airdrop Token
description: How to claim tokens from an airdrop
tags:
  - how-to
  - claim
  - token
---

import DeepLink from '../../../\_admonitions/\_deep_link.md'

## Example

To claim a token from an airdrop, you must call [`claim`](../../../reference-api/classes/TokenOtrDataset.md#claimairdrops) on `dataset(Dataset.TOKEN)`. [`claim`](../../../reference-api/classes/TokenOtrDataset.md#claimairdrops) takes an object of type `BuildcoreRequest<`[`ClaimAirdroppedTokensTangleRequest`](../../../reference-api/interfaces/ClaimAirdroppedTokensTangleRequest.md)`>` as parameter.

```tsx file=../../../../../packages/sdk/examples/token/otr/claim.ts#L9-L11

```

<DeepLink/>

## Full How-To Code

```tsx file=../../../../../packages/sdk/examples/token/otr/claim.ts

```
