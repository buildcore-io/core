import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
@Component({
  selector: 'wen-audit-one-modal',
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalComponent {
  @Input() public entity?: string;
  @Output() wenOnClose = new EventEmitter<void>();

  public close(): void {
    this.wenOnClose.next();
  }
}
