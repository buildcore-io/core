import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { MemberTileComponent } from './member-tile.component';

describe('MemberTileComponent', () => {
  let spectator: Spectator<MemberTileComponent>;
  const createComponent = createComponentFactory({
    component: MemberTileComponent
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
