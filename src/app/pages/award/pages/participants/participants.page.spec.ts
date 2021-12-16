import { IconModule } from '@components/icon/icon.module';
import { MemberCardModule } from '@components/member/components/member-card/member-card.module';
import { RadioModule } from '@components/radio/radio.module';
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { DataService } from '../../services/data.service';
import { ParticipantsPage } from './participants.page';

describe('ParticipantsPage', () => {
  let spectator: Spectator<ParticipantsPage>;
  const createComponent = createRoutingFactory({
    component: ParticipantsPage,
    imports: [ MemberCardModule, RadioModule, IconModule ],
    providers: [ DataService ],
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
