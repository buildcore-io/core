import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { MemberPage } from './member.page';


describe('MemberPage', () => {
  let spectator: Spectator<MemberPage>;
  const createComponent = createRoutingFactory({
    component: MemberPage,
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
