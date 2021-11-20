import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { DateTagModule } from '../../../../@shell/ui/date-tag/date-tag.module';
import { AwardCardComponent } from './award-card.component';


describe('AwardCardComponent', () => {
  let spectator: Spectator<AwardCardComponent>;
  const createComponent = createComponentFactory({
    component: AwardCardComponent,
    imports: [ DateTagModule ]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

it('write tests', () => {
  expect(spectator).toBeDefined();
});
});
