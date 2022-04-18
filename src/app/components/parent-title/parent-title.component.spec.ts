import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { ParentTitleComponent } from './parent-title.component';

describe('FooterComponent', () => {
  let spectator: Spectator<ParentTitleComponent>;
  const createComponent = createComponentFactory({
    component: ParentTitleComponent
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
