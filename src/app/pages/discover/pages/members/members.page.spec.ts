import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { MockComponent, MockProvider } from 'ng-mocks';
import { BehaviorSubject, Observable } from 'rxjs';
import { MemberCardComponent } from '../../../../components/member/components/member-card/member-card.component';
import { MemberApi } from './../../../../@api/member.api';
import { FilterService, SortOptions } from './../../services/filter.service';
import { MembersPage } from './members.page';

describe('MembersPage', () => {
  let spectator: Spectator<MembersPage>;
  const createComponent = createRoutingFactory({
    component: MembersPage,
    declarations: [MockComponent(MemberCardComponent)],
    providers: [MockProvider(<any>FilterService, {
      getHandler: () => {
        return new Observable();
      },
      selectedSort$: new BehaviorSubject<SortOptions>(SortOptions.OLDEST)
    }), MockProvider(MemberApi, {
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
