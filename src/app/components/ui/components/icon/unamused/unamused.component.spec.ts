import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { UnamusedIconComponent } from './unamused.component';


describe('UnamusedComponent', () => {
  let spectator: Spectator<UnamusedIconComponent>;
  const createComponent = createComponentFactory({
    component: UnamusedIconComponent
  });

  beforeEach(() => {
    spectator = createComponent();
  });

it('write tests', () => {
  expect(spectator).toBeDefined();
});
});
