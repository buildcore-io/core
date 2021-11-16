import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { ProposalCardComponent } from './proposal-card.component';


describe('ProposalCardComponent', () => {
  let spectator: Spectator<ProposalCardComponent>;
  const createComponent = createComponentFactory({
    component: ProposalCardComponent
  });

  beforeEach(() => {
    spectator = createComponent();
  });

it('write tests', () => {
  expect(spectator).toBeDefined();
});
});
