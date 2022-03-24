import { IconModule } from '@components/icon/icon.module';
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { ProposalStatusModule } from './../proposal-status/proposal-status.module';
import { ProposalCardComponent } from './proposal-card.component';


describe('ProposalCardComponent', () => {
  let spectator: Spectator<ProposalCardComponent>;
  const createComponent = createRoutingFactory({
    component: ProposalCardComponent,
    imports: [ProposalStatusModule, IconModule]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

it('write tests', () => {
  expect(spectator).toBeDefined();
});
});
