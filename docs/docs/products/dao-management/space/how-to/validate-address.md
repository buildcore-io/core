---
title: Validate Space Address
---

To validate the address of a space, you must call `validateAddress` on `dataset(Dataset.SPACE)`. `validateAddress` takes an object of type `Build5Request<`[`AddressValidationRequest`](../../../../reference-api/interfaces/interfaces_src_search_post.AddressValidationRequest.md)`>` as parameter in wich you can specify the name of the space.

```tsx file=../../../../../../packages/sdk/examples/space/validate_address.ts#L19-L33
```

import ValidateAddress from '../../../../_admonitions/_validate-address.md';

<ValidateAddress/>
