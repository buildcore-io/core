import { RelativeTime } from './relative-time.pipe';

describe('RelativeTime', () => {
  it('create an instance', () => {
    const pipe = new RelativeTime();
    expect(pipe).toBeTruthy();
  });
});
