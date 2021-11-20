import { ProposalCardModule } from "@components/proposal/components/proposal-card/proposal-card.module";
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { DataService } from './../../services/data.service';
import { ProposalsPage } from './proposals.page';

describe('ProposalsPage', () => {
  let spectator: Spectator<ProposalsPage>;
  const createComponent = createRoutingFactory({
    component: ProposalsPage,
    providers: [ DataService ],
    imports: [ ProposalCardModule ]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
