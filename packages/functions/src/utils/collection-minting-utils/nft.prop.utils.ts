import { PropStats } from '@build5/interfaces';

export const propsToAttributes = (props: PropStats | undefined) =>
  Object.entries(props || {}).map(([key, value]) => ({
    trait_type: key,
    value: value.value,
  }));
