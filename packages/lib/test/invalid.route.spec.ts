describe('Invalid route test', () => {
  it('Should return 404', async () => {
    try {
      await fetch('https://soonaverse-dev.web.app/api/asd', {});
      expect('').toBe('Should be blocked');
    } catch (error: any) {
      expect(error).toBe('Not Found');
    }
  });
});
