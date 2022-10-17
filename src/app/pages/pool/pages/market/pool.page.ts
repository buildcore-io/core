import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UntilDestroy } from '@ngneat/until-destroy';

@UntilDestroy()
@Component({
  selector: 'wen-pool',
  templateUrl: './pool.page.html',
  styleUrls: ['./pool.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush

})
export class PoolPage {
}
