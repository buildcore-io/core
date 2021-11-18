import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { MemberCardComponent } from './member-card.component';


describe('MemberCardComponent', () => {
  let spectator: Spectator<MemberCardComponent>;
  const createComponent = createRoutingFactory({
    component: MemberCardComponent
  });

  beforeEach(() => {
    spectator = createComponent();
  });

it('write tests', () => {
  expect(spectator).toBeDefined();
});
});
