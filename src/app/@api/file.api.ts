import { Injectable } from '@angular/core';
import { FullMetadata, getDownloadURL, getMetadata, ref, Storage, uploadBytes } from '@angular/fire/storage';
import { environment } from '@env/environment';
import { NzUploadXHRArgs } from "ng-zorro-antd/upload";
import { from, Observable, of, Subscription } from 'rxjs';
import { FILE_SIZES } from "./../../../functions/interfaces/models/base";

export type FileType = 'space_avatar' | 'space_banner' | 'collection_banner' | 'nft_media' | 'nft_placeholder' | 'token_icon' | 'token_introductionary';

@Injectable({
  providedIn: 'root',
})
export class FileApi {
  public static FILE_SIZES: any = {
    small: '200x200',
    medium: '680x680',
    large: '1600x1600',
  };

  constructor(private storage: Storage) {
    // none.
  }

  public static getUrl(org: string, type?: FileType, size?: FILE_SIZES): string {
    org = org.replace(/^.*\/o/g, 'https://' + environment.fbConfig.storageBucket);
    if (size && type) {
      return org.replace(type, type + '_' + FileApi.FILE_SIZES[size]);
    } else {
      return org;
    }
  }

  public getMetadata(url?: string): Observable<FullMetadata> {
    if (!url) {
      return of(<FullMetadata>{});
    }

    const link = ref(this.storage, url);
    return from(getMetadata(link));
  }

  public upload(memberId: string, item: NzUploadXHRArgs, type: FileType): Subscription {
    const uid: string = item.file.uid;
    const filePath: string = memberId + '/' + uid + '/' + type;
    const fileRef = ref(this.storage, filePath);
    const task = uploadBytes(fileRef, <Blob>item.postFile);

    return from(task.then(() => {
      getDownloadURL(fileRef).then((result) => {
        if (item.onSuccess) {
          item.onSuccess(result, item.file, result);
        } else {
          throw new Error('Unable to upload image due missing handler.');
        }
      });
    }).catch((err) => {
      if (item.onError) {
        item.onError(err, item.file);
      }
    })).subscribe();
  }
}
