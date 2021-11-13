import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { MockComponent } from 'ng-mocks';
import { MemberCardComponent } from './../../../../components/members/components/space-card/member-card.component';
import { MembersPage } from './members.page';

describe('MembersPage', () => {
  let spectator: Spectator<MembersPage>;
  const createComponent = createRoutingFactory({
    component: MembersPage,
    declarations: [MockComponent(MemberCardComponent)]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
