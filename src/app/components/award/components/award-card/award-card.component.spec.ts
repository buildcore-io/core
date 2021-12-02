import { IconModule } from '@components/icon/icon.module';
import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { DateTagModule } from '../../../date-tag/date-tag.module';
import { IpfsBadgeModule } from './../../../../@core/pipes/ipfs-badge/ipfs-badge.module';
import { AwardStatusModule } from './../award-status/award-status.module';
import { AwardCardComponent } from './award-card.component';

describe('AwardCardComponent', () => {
  let spectator: Spectator<AwardCardComponent>;
  const createComponent = createComponentFactory({
    component: AwardCardComponent,
    imports: [ DateTagModule, AwardStatusModule, IconModule, IpfsBadgeModule ]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
