import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { SpaceIconComponent } from './space.component';

describe('GlobeIconComponent', () => {
  let spectator: Spectator<SpaceIconComponent>;
  const createComponent = createComponentFactory({
    component: SpaceIconComponent
  });

  beforeEach(() => {
    spectator = createComponent();
  });

it('write tests', () => {
  expect(spectator).toBeDefined();
});
});
