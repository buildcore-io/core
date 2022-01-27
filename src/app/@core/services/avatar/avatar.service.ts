import { Injectable } from '@angular/core';
import { FileApi } from '@api/file.api';
import { FILE_SIZES } from 'functions/interfaces/models/base';

@Injectable({
  providedIn: 'root'
})
export class AvatarService {

  public getAvatarSize(url?: string|null): string|undefined {
    if (!url) {
      return undefined;
    }

    return FileApi.getUrl(url, 'space_avatar', FILE_SIZES.small);
  }
}
