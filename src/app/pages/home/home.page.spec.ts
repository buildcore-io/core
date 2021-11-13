import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { HomePage } from './home.page';

describe('HomePage', () => {
  let spectator: Spectator<HomePage>;
  const createComponent = createRoutingFactory({
    component: HomePage
  });


  beforeEach(() => {
    spectator = createComponent();
  });

it('write tests', () => {
  expect(spectator).toBeDefined();
});
});
