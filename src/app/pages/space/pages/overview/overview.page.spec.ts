import { AwardsCardModule } from '@components/awards/components/award-card/award-card.module';
import { ProposalsCardModule } from '@components/proposals/components/proposal-card/proposal-card.module';
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { OverviewPage } from './../../pages/overview/overview.page';
import { DataService } from './../../services/data.service';

describe('OverviewPage', () => {
  let spectator: Spectator<OverviewPage>;
  const createComponent = createRoutingFactory({
    component: OverviewPage,
    providers: [ DataService ],
    imports: [ ProposalsCardModule, AwardsCardModule ]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

it('write tests', () => {
  expect(spectator).toBeDefined();
});
});
