import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { FooterComponent } from './footer.component';

describe('FooterComponent', () => {
  let spectator: Spectator<FooterComponent>;
  const createComponent = createComponentFactory({
    component: FooterComponent
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
