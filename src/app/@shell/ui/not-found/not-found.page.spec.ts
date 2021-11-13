import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { NotFoundPage } from './not-found.page';

describe('NotFoundPage', () => {
  let spectator: Spectator<NotFoundPage>;
  const createComponent = createRoutingFactory({
    component: NotFoundPage
  });

  beforeEach(() => {
    spectator = createComponent();
  });

it('write tests', () => {
  expect(spectator).toBeDefined();
});
});
