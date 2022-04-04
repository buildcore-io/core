import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { MoreIconComponent } from './more.component';


describe('MoreIconComponent', () => {
  let spectator: Spectator<MoreIconComponent>;
  const createComponent = createComponentFactory({
    component: MoreIconComponent
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
