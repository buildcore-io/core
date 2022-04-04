import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { TreasuryPage } from './treasury.page';

describe('FundingPage', () => {
  let spectator: Spectator<TreasuryPage>;
  const createComponent = createRoutingFactory({
    component: TreasuryPage
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
