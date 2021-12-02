import { Pipe, PipeTransform } from '@angular/core';
import { FileMetedata, FILE_SIZES } from '../../../../../functions/interfaces/models/base';
import { IPFS_GATEWAY } from './../../../../../functions/interfaces/config';

@Pipe({
  name: 'ipfsAvatar',
})
export class IpfsAvatarPipe implements PipeTransform {
  transform(metadata?: FileMetedata, size: FILE_SIZES.small|FILE_SIZES.large = FILE_SIZES.small): string {
    if (!metadata?.avatar || !metadata?.fileName) {
      return '/assets/mocks/no_avatar.png';
    }

    // This IPFS
    return IPFS_GATEWAY + (size === FILE_SIZES.small ? metadata.avatar : metadata.original) +
           '/' + metadata.fileName + '.png';
  }
}
