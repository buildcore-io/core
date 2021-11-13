import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { ProposalsPage } from './proposals.page';

describe('ProposalsPage', () => {
  let spectator: Spectator<ProposalsPage>;
  const createComponent = createRoutingFactory({
    component: ProposalsPage
  });


  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
