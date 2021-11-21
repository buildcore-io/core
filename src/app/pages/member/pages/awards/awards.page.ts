import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DataService } from './../../services/data.service';

@Component({
  selector: 'wen-awards',
  templateUrl: './awards.page.html',
  styleUrls: ['./awards.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AwardsPage {
  constructor(public data: DataService) {
    // none.
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }
}
