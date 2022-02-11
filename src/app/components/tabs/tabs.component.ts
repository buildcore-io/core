import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export interface TabSection {
  label: string;
  route: string | string[];
}

@Component({
  selector: 'wen-tabs',
  templateUrl: './tabs.component.html',
  styleUrls: ['./tabs.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TabsComponent {
  @Input() tabs: TabSection[] = []
}
