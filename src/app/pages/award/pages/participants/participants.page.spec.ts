import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { ParticipantsPage } from './participants.page';

describe('ParticipantsPage', () => {
  let spectator: Spectator<ParticipantsPage>;
  const createComponent = createRoutingFactory({
    component: ParticipantsPage
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
