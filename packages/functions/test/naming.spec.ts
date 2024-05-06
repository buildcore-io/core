import { WEN_FUNC } from '@buildcore/interfaces';
import { uniq } from 'lodash';
import { WEN_FUNC_TRIGGER, WEN_SCHEDULED, WEN_STORAGE_TRIGGER } from '../src/runtime/common';

describe('Fun name test', () => {
  it('Should check naimg clash', async () => {
    const allNames = [
      ...Object.values(WEN_FUNC),
      ...Object.values(WEN_FUNC_TRIGGER),
      ...Object.values(WEN_SCHEDULED),
      ...Object.values(WEN_STORAGE_TRIGGER),
    ];
    expect(uniq(allNames)).toEqual(allNames);
  });
});
