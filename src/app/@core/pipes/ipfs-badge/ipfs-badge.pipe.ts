import { Pipe, PipeTransform } from '@angular/core';
import { IPFS_GATEWAY } from '../../../../../functions/interfaces/config';
import { FileMetedata, FILE_SIZES } from '../../../../../functions/interfaces/models/base';

@Pipe({
  name: 'ipfsBadge',
})
export class IpfsBadgePipe implements PipeTransform {
  transform(metadata?: FileMetedata, size: FILE_SIZES.small|FILE_SIZES.large = FILE_SIZES.small): string {
    if (!metadata?.avatar || !metadata?.fileName) {
      return '/assets/mocks/trophy.png';
    }

    // This IPFS
    return IPFS_GATEWAY + (size === FILE_SIZES.small ? metadata.avatar : metadata.original) +
           '/' + metadata.fileName + '.png';
  }
}
