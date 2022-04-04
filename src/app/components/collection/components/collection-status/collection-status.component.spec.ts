import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { DateTagModule } from '../../../date-tag/date-tag.module';
import { CollectionStatusComponent } from './collection-status.component';

describe('CollectionStatusComponent', () => {
  let spectator: Spectator<CollectionStatusComponent>;
  const createComponent = createComponentFactory({
    component: CollectionStatusComponent,
    imports: [DateTagModule]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
