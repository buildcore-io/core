import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { SpaceCardModule } from './../../../../components/spaces/components/space-card/space-card.module';
import { SpacesPage } from './spaces.page';

describe('SpacesPage', () => {
  let spectator: Spectator<SpacesPage>;
  const createComponent = createRoutingFactory({
    component: SpacesPage,
    imports: [SpaceCardModule]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

it('write tests', () => {
  expect(spectator).toBeDefined();
});
});
