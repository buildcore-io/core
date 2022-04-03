import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { ProposalStatusComponent } from './proposal-status.component';

describe('ProposalStatusComponent', () => {
  let spectator: Spectator<ProposalStatusComponent>;
  const createComponent = createComponentFactory({
    component: ProposalStatusComponent
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
