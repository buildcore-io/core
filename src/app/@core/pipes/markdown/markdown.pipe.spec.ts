import { MarkDownPipe } from './markdown.pipe';

describe('MarkDownPipe', () => {
  it('create an instance', () => {
    const pipe = new MarkDownPipe();
    expect(pipe).toBeTruthy();
  });
});
