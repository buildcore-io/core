/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, TemplateRef, ViewChild } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { DeviceService } from '@core/services/device';
import { DataService } from '@pages/space/services/data.service';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { FILE_SIZES } from './../../../../../../functions/interfaces/models/base';

@Component({
  selector: 'wen-space-about',
  templateUrl: './space-about.component.html',
  styleUrls: ['./space-about.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpaceAboutComponent {
  @Input() avatarUrl?: string;
  @Output() onLeave = new EventEmitter<void>();

  @ViewChild('allianceSuccessAlert', { static: false }) allianceSuccessAlertTemplate?: TemplateRef<{}>;

  public alliedSpaces = [
    { name: 'IOTA Pioneers', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'established' },
    { name: 'IOTA Pirates', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'recognised' },
    { name: 'IOTA WIKI', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'recognised' }
  ];
  public alliedSpacesDialog = [
    { name: 'IOTA Pioneers1', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'established' },
    { name: 'IOTA Pirates2', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'recognised' },
    { name: 'IOTA WIKI3', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'recognised' },
    { name: 'IOTA Pioneers4', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'established' },
    { name: 'IOTA Pirates5', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'recognised' },
    { name: 'IOTA WIKI6', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'recognised' },
    { name: 'IOTA Pioneers7', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'established' },
    { name: 'IOTA Pirates8', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'recognised' },
    { name: 'IOTA WIKI9', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'recognised' },
    { name: 'IOTA Pioneers10', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'established' },
    { name: 'IOTA Pirates11', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'recognised' },
    { name: 'IOTA WIKI12', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'recognised' },
    { name: 'IOTA Pioneers13', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'established' },
    { name: 'IOTA Pirates14', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'recognised' },
    { name: 'IOTA WIKI15', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'recognised' },
    { name: 'IOTA Pioneers16', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'established' },
    { name: 'IOTA Pirates17', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'recognised' },
    { name: 'IOTA WIKI18', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'recognised' },
    { name: 'IOTA Pioneers19', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'established' },
    { name: 'IOTA Pirates20', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'recognised' },
    { name: 'IOTA WIKI21', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'recognised' },
    { name: 'IOTA Pioneers22', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'established' },
    { name: 'IOTA Pirates23', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'recognised' },
    { name: 'IOTA WIKI24', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'recognised' },
    { name: 'IOTA Pioneers25', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'established' },
    { name: 'IOTA Pirates26', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'recognised' },
    { name: 'IOTA WIKI27', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'recognised' },
    { name: 'IOTA Pioneer28', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'established' },
    { name: 'IOTA Pirates29', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'recognised' },
    { name: 'IOTA WIKI30', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'recognised' },
    { name: 'IOTA Pioneers31', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'established' },
    { name: 'IOTA Pirates32', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'recognised' },
    { name: 'IOTA WIKI33', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', status: 'recognised' }
  ];
  public isAlliancesListModal = false;
  public isNewAllianceModalOpen = false;
  public spaceControl: FormControl = new FormControl('', Validators.required);
  public reputationWeightControl: FormControl = new FormControl(null, Validators.required);

  constructor(
    public deviceService: DeviceService,
    public data: DataService,
    public notificationService: NzNotificationService
  ) { }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public trackByGuardianUid(index: number, item: any): number {
    return item.uid;
  }

  public trackByAlliedSpaceLabel(index: number, item: any): string {
    return item.name;
  }

  public openNewAlliance(): void {
    this.spaceControl.setValue('');
    this.reputationWeightControl.setValue('');
    this.isAlliancesListModal = false;
    this.isNewAllianceModalOpen = true;
  }

  public closeNewAlliance(): void {
    this.spaceControl.setValue('');
    this.reputationWeightControl.setValue('');
    this.isNewAllianceModalOpen = false;
  }

  public onAllianceSave(): void {
    this.closeNewAlliance();
    this.notificationService.template(this.allianceSuccessAlertTemplate!);
  }

  public onAllianceEdit(ally: any): void {
    this.spaceControl.setValue(ally.name);
    this.reputationWeightControl.setValue(0.5);
    this.isAlliancesListModal = false;
    this.isNewAllianceModalOpen = true;
  }
}
