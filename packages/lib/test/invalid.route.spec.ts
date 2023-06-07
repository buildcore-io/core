describe('Invalid route test', () => {
  it('Should return 404', async () => {
    const of = await fetch('https://api-wen2.soonaverse.com/api/asd', {});
    expect(of.ok).toBe(false);
  });
});
