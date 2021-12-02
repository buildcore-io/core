import { IpfsAvatarPipe } from './ipfs-avatar.pipe';

describe('IpfsAvatarPipe', () => {
  it('create an instance', () => {
    const pipe = new IpfsAvatarPipe();
    expect(pipe).toBeTruthy();
  });
});
