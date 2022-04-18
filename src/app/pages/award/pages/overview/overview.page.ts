import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DataService } from './../../services/data.service';

@Component({
  selector: 'wen-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './overview.page.html',
  styleUrls: ['./overview.page.less']
})
export class OverviewPage {
  constructor(public data: DataService) {
    // none.
  }
}
