import { Build5Env } from '../src/Config';
import { isOnlineCheckInterval } from '../src/fetch.utils';
import { MemberRepository } from '../src/repositories/MemberRepository';

describe('MemberRepository test', () => {
  it('Should get member', async () => {
    const uid = '0x003ede16bb59f07b0656280d84b976a4633ad59c';
    const repo = new MemberRepository(Build5Env.TEST);
    const member = await repo.getById(uid);
    expect(member?.uid).toBe('0x003ede16bb59f07b0656280d84b976a4633ad59c');
  });

  it('Should get member by number field', async () => {
    const repo = new MemberRepository(Build5Env.TEST);
    const members = await repo.getByField('age', 12);
    expect(members.length).toBe(1);
  });

  it('Should get member by boolean field', async () => {
    const repo = new MemberRepository(Build5Env.TEST);
    const members = await repo.getByField('isMinor', true);
    expect(members.length).toBe(1);
  });

  afterAll(() => {
    clearInterval(isOnlineCheckInterval);
  });
});
