import { wrappedFetch } from '../src/fetch.utils';

describe('Invalid route test', () => {
  it('Should return 404', async () => {
    try {
      await wrappedFetch('https://soonaverse-dev.web.app/api/asd', {});
      fail();
    } catch (error: any) {
      expect(error).toBe('Not Found');
    }
  });
});
