import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { MockComponent, MockProvider } from 'ng-mocks';
import { Observable } from 'rxjs';
import { MemberCardComponent } from '../../../../components/member/components/member-card/member-card.component';
import { MemberApi } from './../../../../@api/member.api';
import { MembersPage } from './members.page';

describe('MembersPage', () => {
  let spectator: Spectator<MembersPage>;
  const createComponent = createRoutingFactory({
    component: MembersPage,
    declarations: [MockComponent(MemberCardComponent)],
    providers: [MockProvider(MemberApi, {
      last: () => {
        return new Observable();
      }
    })]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
