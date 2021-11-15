import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Space } from "functions/interfaces/models";
import { BehaviorSubject } from 'rxjs';
import { SpaceApi } from './../../../../@api/space.api';

@UntilDestroy()
@Component({
  templateUrl: './spaces.page.html',
  styleUrls: ['./spaces.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpacesPage implements OnInit {
  public spaces$: BehaviorSubject<Space[]> = new BehaviorSubject<Space[]>([]);
  constructor(private spaceApi: SpaceApi) {
    // none.
  }

  public ngOnInit(): void {
    this.spaceApi.last().pipe(untilDestroyed(this)).subscribe(this.spaces$);
  }
}
