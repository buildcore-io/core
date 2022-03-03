import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { Member, Space } from 'functions/interfaces/models';
import { FILE_SIZES } from 'functions/interfaces/models/base';

@Component({
  selector: 'wen-member-reputation-drawer',
  templateUrl: './member-reputation-drawer.component.html',
  styleUrls: ['./member-reputation-drawer.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberReputationDrawerComponent {
  @Input() selectedSpace?: Space;
  @Input() member?: Member;
  @Input() isOpen = false;
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
