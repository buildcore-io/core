import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { Member, Space } from 'functions/interfaces/models';
import { FILE_SIZES } from 'functions/interfaces/models/base';

@Component({
  selector: 'wen-member-reputation-modal',
  templateUrl: './member-reputation-modal.component.html',
  styleUrls: ['./member-reputation-modal.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberReputationModalComponent {
  @Input() selectedSpace?: Space;
  @Input() member?: Member;
  @Input() isOpen = false;
  @Input() width?: number;
  @Output() wenOnClose = new EventEmitter<void>();

  constructor(
    private cd: ChangeDetectorRef
  ) {}

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public onCancel(): void {
    this.isOpen = false;
    this.wenOnClose.emit();
    this.cd.markForCheck();
  }
}
