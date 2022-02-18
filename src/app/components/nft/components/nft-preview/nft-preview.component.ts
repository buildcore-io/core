import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { AvatarService } from '@core/services/avatar';
import { DeviceService } from '@core/services/device';
import { DataService } from '@pages/nft/services/data.service';
import { FILE_SIZES } from 'functions/interfaces/models/base';

@Component({
  selector: 'wen-nft-preview',
  templateUrl: './nft-preview.component.html',
  styleUrls: ['./nft-preview.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NftPreviewComponent {
  @Input() nft?: any | null;
  @Output() onClose = new EventEmitter<void>();

  constructor(
    public deviceService: DeviceService,
    public avatarService: AvatarService,
    public data: DataService
  ) {}

  public close(): void {
    this.nft = null;
    this.onClose.next();
  }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public getValues(obj: any): any[] {
    return Object.values(obj);
  }
}
