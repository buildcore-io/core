---
title: 'Introduction'
describtion: 'Learn about the Buildcore products and how to use them.'
tags: ['products', 'api', 'blockchain', 'nft', 'digital twin', 'token', 'staking', 'trading', 'launchpad', 'staking', 'reputation', 'member', 'project', 'proposal', 'stake reward', 'token distribution', 'dao management']
---

The How-To section shows you how to use the SDK in small code examples. It is grouped into different subsections for handling NFTs, Tokens, Spaces, and more.

## OTR and HTTPS How-Tos

Many how-tos come with OTR and HTTPS examples. If both exist, we recommend using the OTR one.
HTTPS requests often return a [Transaction](../reference-api/interfaces/Transaction.md) object, which contains valuable information like the `targetAddress` in `payload` so you know where to send your funds if needed.  
OTR requests always return an [OtrRequest](../reference-api/classes/DatasetClassOtr.OtrRequest.md) containing a request-specific object. In most cases, you want to use [getBloomDeepLink](../reference-api/classes/DatasetClassOtr.OtrRequest.md#getbloomdeeplink) or [getFireflyDeepLink](../reference-api/classes/DatasetClassOtr.OtrRequest.md#getfireflydeeplink) to get the corresponding deep link so your wallet knows how to create your OTR.
Look at the [Getting Started](../getting-started.mdx) section to learn more about the technical differences between HTTPS and OTR requests.

## Error Handling

Most functions will trow a [WenError](../reference-api/modules.md#wenerror) if the fail.

:::tip

You can find all examples of the SDK in our [repo](https://github.com/build-5/core/tree/master/packages/sdk/examples).

:::
