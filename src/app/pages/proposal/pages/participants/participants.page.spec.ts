import { MemberCardModule } from '@components/member/components/member-card/member-card.module';
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { DataService } from '../../services/data.service';
import { ParticipantsPage } from './participants.page';

describe('ParticipantsPage', () => {
  let spectator: Spectator<ParticipantsPage>;
  const createComponent = createRoutingFactory({
    component: ParticipantsPage,
    imports: [ MemberCardModule, InfiniteScrollModule ],
    providers: [ DataService ],
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
