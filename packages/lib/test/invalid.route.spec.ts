describe('Invalid route test', () => {
  it('Should return 404', async () => {
    const of = await fetch('https://api-wen.build5.com/api/asd', {});
    expect(of.ok).toBe(false);
  });
});
