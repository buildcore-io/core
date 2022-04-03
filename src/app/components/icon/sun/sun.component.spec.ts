import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { SunIconComponent } from './sun.component';


describe('SunIconComponent', () => {
  let spectator: Spectator<SunIconComponent>;
  const createComponent = createComponentFactory({
    component: SunIconComponent
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
