import { ProposalCardModule } from '@components/proposal/components/proposal-card/proposal-card.module';
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { LayoutModule } from '@shell/ui/layout/layout.module';
import { SpaceCardModule } from '../../components/space/components/space-card/space-card.module';
import { AwardCardModule } from './../../components/award/components/award-card/award-card.module';
import { DashboardPage } from './dashboard.page';

describe('DashboardPage', () => {
  let spectator: Spectator<DashboardPage>;
  const createComponent = createRoutingFactory({
    component: DashboardPage,
    imports: [SpaceCardModule, ProposalCardModule, AwardCardModule, LayoutModule]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

it('write tests', () => {
  expect(spectator).toBeDefined();
});
});
