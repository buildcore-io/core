import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { MemberCardComponent } from './member-card.component';


describe('MemberCardComponent', () => {
  let spectator: Spectator<MemberCardComponent>;
  const createComponent = createComponentFactory({
    component: MemberCardComponent
  });

  beforeEach(() => {
    spectator = createComponent();
  });

it('write tests', () => {
  expect(spectator).toBeDefined();
});
});
