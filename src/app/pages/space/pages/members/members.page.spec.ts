import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { MembersPage } from './members.page';

describe('MembersPage', () => {
  let spectator: Spectator<MembersPage>;
  const createComponent = createRoutingFactory({
    component: MembersPage
  });

  beforeEach(() => {
    spectator = createComponent();
  });

it('write tests', () => {
  expect(spectator).toBeDefined();
});
});
