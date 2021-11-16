import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject } from 'rxjs';
import { Member } from './../../../../../../functions/interfaces/models/member';
import { MemberApi } from './../../../../@api/member.api';

@UntilDestroy()
@Component({
  templateUrl: './members.page.html',
  styleUrls: ['./members.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MembersPage implements OnInit {
  public members$: BehaviorSubject<Member[]> = new BehaviorSubject<Member[]>([]);
  constructor(private memberApi: MemberApi) {
    // none.
  }

  public ngOnInit(): void {
    this.memberApi.last().pipe(untilDestroyed(this)).subscribe(this.members$);
  }
}
