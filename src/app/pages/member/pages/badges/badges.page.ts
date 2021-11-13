import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'wen-badges',
  templateUrl: './badges.page.html',
  styleUrls: ['./badges.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BadgesPage {
}
