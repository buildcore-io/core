import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { LogOutIconComponent } from './log-out.component';

describe('LogOutIconComponent', () => {
  let spectator: Spectator<LogOutIconComponent>;
  const createComponent = createComponentFactory({
    component: LogOutIconComponent
  });

  beforeEach(() => {
    spectator = createComponent();
  });

it('write tests', () => {
  expect(spectator).toBeDefined();
});
});
