import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { Token } from '@functions/interfaces/models';

@Component({
  selector: 'wen-token-trade-detail-modal',
  templateUrl: './token-trade-detail-modal.component.html',
  styleUrls: ['./token-trade-detail-modal.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenTradeDetailModalComponent {
  @Input() set isOpen(value: boolean) {
    this._isOpen = value;
  }
  public get isOpen(): boolean {
    return this._isOpen;
  }
  @Input() token?: Token;
  @Output() wenOnClose = new EventEmitter<void>();

  private _isOpen = false;

  constructor(
    private cd: ChangeDetectorRef
  ) {}

  public close(): void {
    this.reset();
    this.wenOnClose.next();
  }

  public reset(): void {
    this.isOpen = false;
    this.cd.markForCheck();
  }
}
