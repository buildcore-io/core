---
title: Track OTRs
tags:
  - how-to
  - track
---

Sometimes you want to track your OTR for example to check if a purchase was successful.
You can do that by using the tag of the request.

To do that call [`getTag`](../reference-api/classes/DatasetClassOtr.OtrRequest.md#gettag) on `OtrRequest`.
[`getTag`](../reference-api/classes/DatasetClassOtr.OtrRequest.md#gettag) takes a firefly deeplink as parameter.

```tsx file=../../../packages/sdk/examples/nft/otr/purchase.ts#L24
```

You can use the tag to get an observable object by calling [`trackByTag`](../reference-api/classes/ProjectWrapper#trackbytag) on `ProjectWrapper`.

```tsx file=../../../packages/sdk/examples/nft/otr/purchase.ts#L25-L27
```
