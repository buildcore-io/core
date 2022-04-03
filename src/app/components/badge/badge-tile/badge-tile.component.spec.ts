import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { IpfsBadgeModule } from './../../../@core/pipes/ipfs-badge/ipfs-badge.module';
import { BadgeTileComponent } from './badge-tile.component';


describe('BadgeTileComponent', () => {
  let spectator: Spectator<BadgeTileComponent>;
  const createComponent = createComponentFactory({
    component: BadgeTileComponent,
    imports: [IpfsBadgeModule]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
