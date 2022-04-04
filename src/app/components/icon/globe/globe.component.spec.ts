import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { GlobeIconComponent } from './globe.component';

describe('GlobeIconComponent', () => {
  let spectator: Spectator<GlobeIconComponent>;
  const createComponent = createComponentFactory({
    component: GlobeIconComponent
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
