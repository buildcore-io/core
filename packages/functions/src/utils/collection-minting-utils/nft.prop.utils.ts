import { PropStats } from '@build-5/interfaces';

export const propsToAttributes = (props: PropStats | undefined) =>
  Object.entries(props || {}).map(([key, value]) => ({
    trait_type: key,
    value: value.value,
  }));
