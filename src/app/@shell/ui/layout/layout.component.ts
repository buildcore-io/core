import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'wen-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayoutComponent {}
