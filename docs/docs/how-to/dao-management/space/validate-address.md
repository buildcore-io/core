---
title: Validate Space Address
---

To validate the address of a space, you must call [`validateAddress`](../../../reference-api/classes/SpaceDataset.md#validateaddress) on `dataset(Dataset.SPACE)`. [`validateAddress`](../../../reference-api/classes/SpaceDataset.md#validateaddress) takes an object of type [`BuildcoreRequest`](../../../reference-api/interfaces/BuildcoreRequest)`<`[`AddressValidationRequest`](../../../reference-api/interfaces/AddressValidationRequest.md)`>` as parameter in wich you can specify the name of the space.

```tsx file=../../../../../packages/sdk/examples/space/validate_address.ts#L19-L33

```

[`validateAddress`](../../../reference-api/classes/SpaceDataset.md#validateaddress) returns an oject of type [`Transaction`](../../../reference-api/interfaces/Transaction.md).

import ValidateAddress from '../../../\_admonitions/\_validate-address.md';

<ValidateAddress/>

## Full How-To Code

```tsx file=../../../../../packages/sdk/examples/space/validate_address.ts

```
