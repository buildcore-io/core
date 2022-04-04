import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { DateTagModule } from '../../../date-tag/date-tag.module';
import { AwardStatusComponent } from './award-status.component';


describe('AwardStatusComponent', () => {
  let spectator: Spectator<AwardStatusComponent>;
  const createComponent = createComponentFactory({
    component: AwardStatusComponent,
    imports: [DateTagModule]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
