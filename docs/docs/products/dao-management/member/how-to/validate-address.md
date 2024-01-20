---
title: Validate Space Address
---

To validate the address of a member, you must call `validateAddress` on `dataset(Dataset.MEMBER)`. `validateAddress` takes an object of type `Build5Request<`[`AddressValidationRequest`](../../../../search-post/interfaces/AddressValidationRequest.md)`>` as parameter.

```tsx file=../../../../../../packages/sdk/examples/member/validate_address.ts#L16-L30
```

import ValidateAddress from '../../../../_admonitions/_validate-address.md';

<ValidateAddress/>