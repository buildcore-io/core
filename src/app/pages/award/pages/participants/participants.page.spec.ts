import { MembersCardModule } from '@components/members/components/member-card/member-card.module';
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { DataService } from '../../services/data.service';
import { ParticipantsPage } from './participants.page';

describe('ParticipantsPage', () => {
  let spectator: Spectator<ParticipantsPage>;
  const createComponent = createRoutingFactory({
    component: ParticipantsPage,
    imports: [ MembersCardModule ],
    providers: [ DataService ],
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
