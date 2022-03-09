import { Time } from './time.pipe';

describe('Time', () => {
  it('create an instance', () => {
    const pipe = new Time();
    expect(pipe).toBeTruthy();
  });
});
