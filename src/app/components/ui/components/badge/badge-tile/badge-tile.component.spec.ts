import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { BadgeTileComponent } from './badge-tile.component';


describe('BadgeTileComponent', () => {
  let spectator: Spectator<BadgeTileComponent>;
  const createComponent = createComponentFactory({
    component: BadgeTileComponent
  });

  beforeEach(() => {
    spectator = createComponent();
  });

it('write tests', () => {
  expect(spectator).toBeDefined();
});
});
