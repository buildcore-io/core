import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { UpsertPage } from './upsert.page';

describe('UpsertPage', () => {
  let spectator: Spectator<UpsertPage>;
  const createComponent = createRoutingFactory({
    component: UpsertPage
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
