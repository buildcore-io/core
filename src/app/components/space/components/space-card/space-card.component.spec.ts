import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { IconModule } from '../../../icon/icon.module';
import { SpaceCardComponent } from './space-card.component';


describe('SpaceCardComponent', () => {
  let spectator: Spectator<SpaceCardComponent>;
  const createComponent = createRoutingFactory({
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
