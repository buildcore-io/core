import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, TemplateRef } from '@angular/core';
import { DeviceService } from '@core/services/device';

@Component({
  selector: 'wen-modal-drawer',
  templateUrl: './modal-drawer.component.html',
  styleUrls: ['./modal-drawer.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModalDrawerComponent {
  @Input() title = '';
  @Input() content?: TemplateRef<unknown>;
  @Input() set isOpen(value: boolean) {
    this._isOpen = value;
  }
  public get isOpen(): boolean {
    return this._isOpen;
  }
  @Input() modalWidth = 760;
  @Input() showHeader = true;
  @Output() wenOnClose = new EventEmitter<void>();
  
  private _isOpen = false;

  constructor(
    public deviceService: DeviceService
  ) { }

  public close(): void {
    this.isOpen = false;
    this.wenOnClose.next();
  }
}
