import { MemberCardModule } from "@components/member/components/member-card/member-card.module";
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { DataService } from "@pages/space/services/data.service";
import { MembersPage } from './members.page';

describe('MembersPage', () => {
  let spectator: Spectator<MembersPage>;
  const createComponent = createRoutingFactory({
    component: MembersPage,
    providers: [ DataService ],
    imports: [ MemberCardModule ]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

it('write tests', () => {
  expect(spectator).toBeDefined();
});
});
