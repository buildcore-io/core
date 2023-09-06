---
title: Getting started
---

Build.5 API provides various way to interact with our platform. You can of course read directly IOTA/Shimmer or you can use our friendly API's to simplify access.

There are REST API to simplify read and write operations. See following:
- [GET](api-get) - Use this APIs to get any data from Build.5
- [WSS](api-get) - Any [GET](api-get) can be requested as wss:// to receive web socket with real time updates
- [POST](api-post) - Use this APIs to post any requests to Build.5 (alternative to [OTR]

As we plan to eventually migrate all features into L1 / L2 Smart Contracts (once the technology is available) you might want to use our On Tangle Request instead. This enables you to be more future proof and reduce amount of refactoring / UI changes you might have to do in the future. It provides more secure channel as all communication happens directly with your node and over Tangle.

- [OTR](api-otr) - omnichannel to interact with Build.5. Same as [POST](api-post) except all communication is done over Tangle.

We provide two end points. One for testing and one for production. See below:

```
// Production end-point
https://api.build5.com

// Sandbox available end point
https://api-test.build5.com

```

> Make sure to consider [API's limitations](limitations)

Let's do a simple GET Request to get member's object:

```
// Get @adam_unchained profile
curl --request GET 'https://api.build5.com/api/getById?collection=member&uid=0x551fd2c7c7bf356bac194587dab2fcd46420054b'
```

If you're interested to see tons of various examples we recommend following repositories: 
- https://github.com/soonaverse/app/tree/master/src/app/%40api - Example of various interaction Soonaverse does with Build.5 APIs. Both write and read.
- https://github.com/build-5/build5-otr-examples - Here you can find various OTR examples.