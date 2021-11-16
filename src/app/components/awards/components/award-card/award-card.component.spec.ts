import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { AwardCardComponent } from './award-card.component';


describe('AwardCardComponent', () => {
  let spectator: Spectator<AwardCardComponent>;
  const createComponent = createComponentFactory({
    component: AwardCardComponent
  });

  beforeEach(() => {
    spectator = createComponent();
  });

it('write tests', () => {
  expect(spectator).toBeDefined();
});
});
