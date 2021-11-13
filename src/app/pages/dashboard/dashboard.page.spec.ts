import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { SpaceCardModule } from './../../components/spaces/components/space-card/space-card.module';
import { DashboardPage } from './dashboard.page';

describe('DashboardPage', () => {
  let spectator: Spectator<DashboardPage>;
  const createComponent = createRoutingFactory({
    component: DashboardPage,
    imports: [SpaceCardModule]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

it('write tests', () => {
  expect(spectator).toBeDefined();
});
});
