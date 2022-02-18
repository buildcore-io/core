import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'wen-collapse',
  templateUrl: './collapse.component.html',
  styleUrls: ['./collapse.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollapseComponent {
  @Input() title?: string;
  public isCollapsed = false;
}
