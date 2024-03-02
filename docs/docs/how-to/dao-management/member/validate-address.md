---
title: Validate Space Address
---

To validate the address of a member, you must call [`validateAddress`](../../../reference-api/classes/MemberDataset.md#validateaddress) on `dataset(Dataset.MEMBER)`. [`validateAddress`](../../../reference-api/classes/MemberDataset.md#validateaddress) takes an object of type [`Build5Request`](../../../reference-api/interfaces/Build5Request)`<`[`AddressValidationRequest`](../../../reference-api/interfaces/AddressValidationRequest.md)`>` as parameter.

```tsx file=../../../../../packages/sdk/examples/member/validate_address.ts#L16-L30
```

[`validateAddress`](../../../reference-api/classes/MemberDataset.md#validateaddress) returns an oject of type [`Transaction`](../../../reference-api/interfaces/Transaction.md).

import ValidateAddress from '../../../_admonitions/_validate-address.md';

<ValidateAddress/>
