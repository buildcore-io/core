import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Award, Proposal } from '@functions/interfaces/models';
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

  public trackByUid(index: number, item: Award | Proposal) {
    return item.uid;
  }
}
