import { WEN_FUNC } from '@buildcore/interfaces';
describe('Function name test', () => {
  it('Func name must be lowercase', async () => {
    for (const name of Object.values(WEN_FUNC)) {
      expect(/[A-Z]/.test(name)).toBe(false);
    }
  });
});
