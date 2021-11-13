import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { NewPage } from './../../../space/pages/new/new.page';


describe('NewPage', () => {
  let spectator: Spectator<NewPage>;
  const createComponent = createRoutingFactory({
    component: NewPage
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
