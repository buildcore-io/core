import { SoonEnv } from '../src/Config';
import { MemberRepository } from '../src/repositories/MemberRepository';

describe('MemberRepository test', () => {
  it('Should get member', async () => {
    const uid = '0x003ede16bb59f07b0656280d84b976a4633ad59c';
    const repo = new MemberRepository(SoonEnv.DEV);
    const members = await repo.getById([uid]);
    expect(members[0].uid).toBe('0x003ede16bb59f07b0656280d84b976a4633ad59c');
  });
});
