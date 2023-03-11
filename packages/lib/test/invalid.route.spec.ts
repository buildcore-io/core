describe('Invalid route test', () => {
  it('Should return 404', async () => {
    const of = await fetch('https://soonaverse-dev.web.app/api/asd', {});
    expect(of.ok).toBe(false);
  });
});
