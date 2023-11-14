import { Build5Env } from '../src/Config';
import { isOnlineCheckInterval } from '../src/fetch.utils';
import { TokenDistributionRepository } from '../src/repositories/token/TokenDistributionRepository';
import { TokenMarketRepository } from '../src/repositories/token/TokenMarketRepository';
import { TokenRepository } from '../src/repositories/token/TokenRepository';
import { TokenStatsRepository } from '../src/repositories/token/TokenStatsRepository';

describe('MemberRepository test', () => {
  it('Should get by space', async () => {
    const space = '0xc61697cfd77e96a4c9d35ded0a752b2d7b923bbb';
    const repo = new TokenRepository(Build5Env.TEST);
    const tokens = await repo.getBySpace(space);
    expect(tokens.length).toBe(1);
    expect(tokens[0].space).toBe(space);
  });

  it('Should get by space as fieldName', async () => {
    const space = '0xc61697cfd77e96a4c9d35ded0a752b2d7b923bbb';
    const repo = new TokenRepository(Build5Env.TEST);
    const tokens = await repo.getByField('space', space);
    expect(tokens.length).toBe(1);
    expect(tokens[0].space).toBe(space);
  });

  it('Should get token stats', async () => {
    const token = '0x00688fbd26eda8e4040cb1a896432618e6c1b446';
    const repo = new TokenStatsRepository(Build5Env.TEST);
    const stats = await repo.getById(token, token);
    expect(stats?.parentId).toBe(token);
    expect(stats?.volumeTotal).toBe(8);
  });

  it('Should get all distributions', async () => {
    const token = '0x00688fbd26eda8e4040cb1a896432618e6c1b446';
    const repo = new TokenDistributionRepository(Build5Env.TEST);
    const distributions = await repo.getAll(token);
    expect(distributions.length).toBe(2);
  });

  it('Should get distribution for member', async () => {
    const token = '0x00688fbd26eda8e4040cb1a896432618e6c1b446';
    const member = '0x785f9fad6751c5d0a30c69d248f6a8fda567e93b';
    const repo = new TokenDistributionRepository(Build5Env.TEST);
    const distributions = await repo.getByField(token, 'uid', member);
    expect(distributions.length).toBe(1);
  });

  it('Should get token price', async () => {
    const token = '0x8247dfcef17354c295e1d3611210dbd45ef5e09a';
    const repo = new TokenMarketRepository(Build5Env.TEST);
    const response = await repo.getTokenPrice(token);
    expect(response?.price).toBe(2500000);
  });

  afterAll(() => {
    clearInterval(isOnlineCheckInterval);
  });
});
