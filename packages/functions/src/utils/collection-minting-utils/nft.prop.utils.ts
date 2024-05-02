import { PropStats } from '@build-5/interfaces';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const propsToAttributes = (props: PropStats | Record<string, any> | undefined) =>
  Object.entries(props || {}).map(([key, value]) => ({
    trait_type: key,
    value: value.value,
  }));
