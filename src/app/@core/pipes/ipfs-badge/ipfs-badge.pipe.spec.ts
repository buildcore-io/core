import { IpfsBadgePipe } from "./ipfs-badge.pipe";

describe('IpfsBadgePipe', () => {
  it('create an instance', () => {
    const pipe = new IpfsBadgePipe();
    expect(pipe).toBeTruthy();
  });
});
