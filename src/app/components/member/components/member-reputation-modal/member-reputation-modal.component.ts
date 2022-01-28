import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { Member } from 'functions/interfaces/models';
import { FILE_SIZES } from 'functions/interfaces/models/base';

export interface MemberAllianceItem {
  avatar?: string;
  name: string;
  weight: number;
  totalAwards: number;
  totalXp: number;
}

@Component({
  selector: 'wen-member-reputation-modal',
  templateUrl: './member-reputation-modal.component.html',
  styleUrls: ['./member-reputation-modal.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberReputationModalComponent {
  @Input() alliances: MemberAllianceItem[] = [];
  @Input() member?: Member;
  @Input() isOpen = false;
  @Input() leftPosition?: number;
  @Input() topPosition?: number;
  @Input() rightPosition?: number;
  @Input() bottomPosition?: number;
  @Input() width?: number;
  @Output() onClose = new EventEmitter<void>();

  constructor(
    private cd: ChangeDetectorRef
  ) {}

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public onCancel(): void {
    this.isOpen = false;
    this.onClose.emit();
    this.cd.markForCheck();
  }
}
