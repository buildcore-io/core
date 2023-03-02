import axios from 'axios';

describe('Invalid route test', () => {
  it('Should return 404', async () => {
    try {
      await axios({
        method: 'get',
        url: 'https://soonaverse-dev.web.app/api/asd',
      });
      fail();
    } catch (error: any) {
      expect(error.response.status).toBe(404);
    }
  });
});
