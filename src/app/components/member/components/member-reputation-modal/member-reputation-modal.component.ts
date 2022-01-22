import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Member } from 'functions/interfaces/models';
import { FILE_SIZES } from 'functions/interfaces/models/base';

export interface AllianceItem {
  img: string;
  name: string;
  awards: number;
  iXP: number;
}

@UntilDestroy()
@Component({
  selector: 'wen-member-reputation-modal',
  templateUrl: './member-reputation-modal.component.html',
  styleUrls: ['./member-reputation-modal.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberReputationModalComponent implements OnInit {
  @Input() 
  public set alliances(value: AllianceItem[]) {
    this._alliances = value;
    this.totalAwards = this.alliances.reduce((acc, alliance) => acc + alliance.awards, 0);
    this.totaliXP = this.alliances.reduce((acc, alliance) => acc + alliance.iXP, 0);
  }
  public get alliances(): AllianceItem[] {
    return this._alliances;
  }
  @Input() member?: Member;

  @ViewChild('wrapper', { static: true }) wrapper?: ElementRef;

  private _alliances: AllianceItem[] = [];
  public totalAwards = 0;
  public totaliXP = 0;
  public leftPosition = true;

  constructor(
    public deviceService: DeviceService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
      this.deviceService.innerWidth$
        .pipe(
          untilDestroyed(this)
        )
        .subscribe(width => {
          this.leftPosition =
              width > this.wrapper?.nativeElement.getBoundingClientRect().right +
              (this.leftPosition ? 0 : this.wrapper?.nativeElement.getBoundingClientRect().width);
          this.cd.markForCheck();
        });
  }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }
}
