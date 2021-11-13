import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { IconModule } from './../../../../components/ui/components/icon/icon.module';
import { SpaceCardComponent } from './space-card.component';


describe('SpaceCardComponent', () => {
  let spectator: Spectator<SpaceCardComponent>;
  const createComponent = createComponentFactory({
    component: SpaceCardComponent,
    imports: [IconModule]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

it('write tests', () => {
  expect(spectator).toBeDefined();
});
});
