import { Injectable } from '@angular/core';
import { FileApi } from '@api/file.api';
import { FILE_SIZES } from '@functions/interfaces/models/base';

@Injectable({
  providedIn: 'root'
})
export class PreviewImageService {
  public getAvatarSize(url?: string|null): string|undefined {
    if (!url) {
      return undefined;
    }

    return FileApi.getUrl(url, 'space_avatar', FILE_SIZES.small);
  }

  public getNftSize(url?: string|null): string|undefined {
    if (!url) {
      return undefined;
    }

    return FileApi.getUrl(url, 'nft_media', FILE_SIZES.medium);
  }

  public getCollectionSize(url?: string|null): string|undefined {
    if (!url) {
      return undefined;
    }

    return FileApi.getUrl(url, 'collection_banner', FILE_SIZES.medium);
  }
}
