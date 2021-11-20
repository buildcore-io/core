import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { RocketIconComponent } from './rocket.component';


describe('RocketIconComponent', () => {
  let spectator: Spectator<RocketIconComponent>;
  const createComponent = createComponentFactory({
    component: RocketIconComponent
  });

  beforeEach(() => {
    spectator = createComponent();
  });

it('write tests', () => {
  expect(spectator).toBeDefined();
});
});
