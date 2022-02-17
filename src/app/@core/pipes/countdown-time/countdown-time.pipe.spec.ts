import { CountdownTime } from './countdown-time.pipe';

describe('CountdownTime', () => {
  it('create an instance', () => {
    const pipe = new CountdownTime();
    expect(pipe).toBeTruthy();
  });
});
