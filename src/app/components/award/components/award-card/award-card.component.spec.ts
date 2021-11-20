import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { DateTagModule } from '../../../date-tag/date-tag.module';
import { AwardStatusModule } from './../award-status/award-status.module';
import { AwardCardComponent } from './award-card.component';

describe('AwardCardComponent', () => {
  let spectator: Spectator<AwardCardComponent>;
  const createComponent = createComponentFactory({
    component: AwardCardComponent,
    imports: [ DateTagModule, AwardStatusModule ]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
