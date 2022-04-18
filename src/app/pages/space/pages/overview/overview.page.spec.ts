import { AwardCardModule } from '@components/award/components/award-card/award-card.module';
import { ProposalCardModule } from '@components/proposal/components/proposal-card/proposal-card.module';
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { OverviewPage } from './../../pages/overview/overview.page';
import { DataService } from './../../services/data.service';

describe('OverviewPage', () => {
  let spectator: Spectator<OverviewPage>;
  const createComponent = createRoutingFactory({
    component: OverviewPage,
    providers: [ DataService ],
    imports: [ ProposalCardModule, AwardCardModule ]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
