---
title: Getting started
---

Publicly available end points:

```
// Production end-point
https://api.build5.com

// Sandbox available end point
https://api-wen.build5.com

```

You can interact with Build.5 through various means:

- REST API
  - [GET](api-get) - Use this APIs to get any data from Build.5
  - [POST](api-post) - Use this APIs to post any requests to Build.5 (alternative to [OTR](api-otr))
- [OTR](api-otr) (_Recommended_) - omnichannel to interact with Build.5. Same as [POST](api-post) except it'll be more future proof as Build.5 migrates functionality into L1/L2


> Make sure to consider [API's limitations](limitations)

Let's do a simple GET Request to get member's object:

```
// Get @adam_unchained profile
curl --request GET 'https://api.build5.com/api/getById?collection=member&uid=0x551fd2c7c7bf356bac194587dab2fcd46420054b'
```