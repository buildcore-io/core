import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { ProfilePage } from './profile.page';

describe('ProfilePage', () => {
  let spectator: Spectator<ProfilePage>;
  const createComponent = createRoutingFactory({
    component: ProfilePage,
    params: {},
    data: {}
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
