import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DataService } from './../../services/data.service';

@Component({
  selector: 'wen-badges',
  templateUrl: './badges.page.html',
  styleUrls: ['./badges.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BadgesPage {
  constructor(public data: DataService) {

  }
}
