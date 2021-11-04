import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  templateUrl: './overview.page.html',
  styleUrls: ['./overview.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewPage {}
