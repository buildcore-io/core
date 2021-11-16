import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject } from 'rxjs';
import { Award } from './../../../../../../functions/interfaces/models/award';
import { AwardApi } from './../../../../@api/award.api';

@UntilDestroy()
@Component({
  templateUrl: './awards.page.html',
  styleUrls: ['./awards.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush

})
export class AwardsPage implements OnInit {
  public award$: BehaviorSubject<Award[]> = new BehaviorSubject<Award[]>([]);
  constructor(private awardApi: AwardApi) {
    // none.
  }

  public ngOnInit(): void {
    this.awardApi.last().pipe(untilDestroyed(this)).subscribe(this.award$);
  }
}
