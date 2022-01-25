import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { Member } from 'functions/interfaces/models';
import { FILE_SIZES } from 'functions/interfaces/models/base';

export interface AllianceItem {
  img: string;
  name: string;
  awards: number;
  XP: number;
}

@Component({
  selector: 'wen-member-reputation-modal',
  templateUrl: './member-reputation-modal.component.html',
  styleUrls: ['./member-reputation-modal.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberReputationModalComponent {
  @Input() 
  public set alliances(value: AllianceItem[]) {
    this._alliances = value;
    this.totalAwards = this.alliances.reduce((acc, alliance) => acc + alliance.awards, 0);
    this.totalXP = this.alliances.reduce((acc, alliance) => acc + alliance.XP, 0);
  }
  public get alliances(): AllianceItem[] {
    return this._alliances;
  }
  @Input() member?: Member;
  @Input() isOpen = false;
  @Input() leftPosition?: number;
  @Input() topPosition?: number;
  @Input() rightPosition?: number;
  @Input() bottomPosition?: number;
  @Output() onClose = new EventEmitter<void>();

  @ViewChild('wrapper', { static: true }) wrapper?: ElementRef;

  private _alliances: AllianceItem[] = [];
  public totalAwards = 0;
  public totalXP = 0;

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
