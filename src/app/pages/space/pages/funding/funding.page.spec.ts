import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { FundingPage } from './funding.page';

describe('FundingPage', () => {
  let spectator: Spectator<FundingPage>;
  const createComponent = createRoutingFactory({
    component: FundingPage
  });

  beforeEach(() => {
    spectator = createComponent();
  });

it('write tests', () => {
  expect(spectator).toBeDefined();
});
});
