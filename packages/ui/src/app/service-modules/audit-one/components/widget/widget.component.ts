import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input } from '@angular/core';

@Component({
  selector: 'wen-audit-one-widget',
  templateUrl: './widget.component.html',
  styleUrls: ['./widget.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetComponent {
  @Input() public entity?: string;
  public isAuditOneModalOpen = false;
  constructor(public cd: ChangeDetectorRef) {}

  public openAuditOneModal() {
    this.isAuditOneModalOpen = true;
    this.cd.markForCheck();
  }

  public closeAuditOneModal(): void {
    this.isAuditOneModalOpen = false;
    this.cd.markForCheck();
  }
}
