import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'wen-tabs',
  templateUrl: './tabs.component.html',
  styleUrls: ['./tabs.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TabsComponent {
  @Input() tabs: { label: string, route: string | string[] }[] = []
}
