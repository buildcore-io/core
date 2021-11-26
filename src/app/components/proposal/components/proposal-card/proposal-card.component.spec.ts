import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { ProposalStatusModule } from './../proposal-status/proposal-status.module';
import { ProposalCardComponent } from './proposal-card.component';


describe('ProposalCardComponent', () => {
  let spectator: Spectator<ProposalCardComponent>;
  const createComponent = createComponentFactory({
    component: ProposalCardComponent,
    imports: [ProposalStatusModule]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

it('write tests', () => {
  expect(spectator).toBeDefined();
});
});
