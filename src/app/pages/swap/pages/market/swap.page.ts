import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UntilDestroy } from '@ngneat/until-destroy';

@UntilDestroy()
@Component({
  selector: 'wen-swap',
  templateUrl: './swap.page.html',
  styleUrls: ['./swap.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush

})
export class SwapPage {
}
