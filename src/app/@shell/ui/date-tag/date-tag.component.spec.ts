import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { DateTagComponent } from './date-tag.component';

describe('DateTagComponent', () => {
  let spectator: Spectator<DateTagComponent>;
  const createComponent = createComponentFactory({
    component: DateTagComponent
  });

  beforeEach(() => {
    spectator = createComponent();
  });

it('write tests', () => {
  expect(spectator).toBeDefined();
});
});
