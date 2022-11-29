import { Injectable } from '@angular/core';
import {
  FullMetadata,
  getDownloadURL,
  getMetadata,
  ref,
  Storage,
  uploadBytes,
} from '@angular/fire/storage';
import { FILE_SIZES } from '@soonaverse/interfaces';
import { NzUploadXHRArgs } from 'ng-zorro-antd/upload';
import { from, Observable, of, Subscription } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class FileApi {
  public static FILE_SIZES: any = {
    small: '200X200',
    medium: '680X680',
    large: '1600X1600',
  };

  constructor(private storage: Storage) {
    // none.
  }

  public static isMigrated(url: string): boolean {
    return !url.startsWith('https://firebasestorage.googleapis.com/v0/b/');
  }

  public static getUrl(org: string, size?: FILE_SIZES): string {
    if (!this.isMigrated(org) || !size) {
      return org;
    }

    return org.replace(/\.[^/.]+$/, size + '.webp');
  }

  public static getVideoPreview(org: string): string | undefined {
    if (!this.isMigrated(org)) {
      return undefined;
    }

    return org.replace(/\.[^/.]+$/, '_preview.webp');
  }

  public getMetadata(url?: string): Observable<FullMetadata> {
    if (!url) {
      return of(<FullMetadata>{});
    }

    const link = ref(this.storage, url);
    return from(getMetadata(link));
  }

  public randomFileName() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0,
        v = c == 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  public upload(memberId: string, item: NzUploadXHRArgs): Subscription {
    const re = /(?:\.([^.]+))?$/;
    const ext = re.exec(item.file.name!)?.[1];
    const uid: string = item.file.uid;
    const filePath: string =
      memberId + '/' + uid + '/' + this.randomFileName() + (ext ? '.' + ext : '.webp');
    const fileRef = ref(this.storage, filePath);
    const task = uploadBytes(fileRef, <Blob>item.postFile);

    return from(
      task
        .then(() => {
          getDownloadURL(fileRef).then((result) => {
            if (item.onSuccess) {
              item.onSuccess(result, item.file, result);
            } else {
              throw new Error('Unable to upload image due missing handler.');
            }
          });
        })
        .catch((err) => {
          if (item.onError) {
            item.onError(err, item.file);
          }
        }),
    ).subscribe();
  }
}
