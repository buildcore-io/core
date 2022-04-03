import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { MoonIconComponent } from './moon.component';


describe('MoonIconComponent', () => {
  let spectator: Spectator<MoonIconComponent>;
  const createComponent = createComponentFactory({
    component: MoonIconComponent
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
