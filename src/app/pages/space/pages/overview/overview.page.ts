import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DataService } from "@pages/space/services/data.service";

@Component({
  selector: 'wen-overview',
  templateUrl: './overview.page.html',
  styleUrls: ['./overview.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewPage {
  constructor(public data: DataService) {
    // added.
  }
}
