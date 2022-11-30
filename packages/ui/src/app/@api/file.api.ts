import { Injectable } from '@angular/core';
import {
  FullMetadata,
  getDownloadURL,
  getMetadata,
  ref,
  Storage,
  uploadBytes,
} from '@angular/fire/storage';
import { environment } from '@env/environment';
import { Bucket, FILE_SIZES } from '@soonaverse/interfaces';
import { NzUploadXHRArgs } from 'ng-zorro-antd/upload';
import { from, Observable, of, Subscription } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class FileApi {
  constructor(private storage: Storage) {
    // none.
  }

  public static isMigrated(url: string): boolean {
    return !url.startsWith('https://firebasestorage.googleapis.com/v0/b/');
  }

  public static getUrl(org: string, size?: FILE_SIZES): string {
    const extensionPat = /\.[^/.]+$/;
    const ext = org.match(extensionPat)?.[0]?.replace('.', '_');
    if (!this.isMigrated(org) || !size || !ext) {
      return org;
    }
    return org.replace(extensionPat, ext + '_' + size + '.webp');
  }

  public static getVideoPreview(org: string): string | undefined {
    const extensionPat = /\.[^/.]+$/;
    const ext = org.match(extensionPat)?.[0]?.replace('.', '_');
    if (!this.isMigrated(org) || !ext) {
      return undefined;
    }

    return org.replace(/\.[^/.]+$/, ext + '_preview.webp');
  }

  public getMetadata(url?: string): Observable<FullMetadata> {
    if (!url) {
      return of(<FullMetadata>{});
    }

    // Change to relative path:
    if (FileApi.isMigrated(url)) {
      url = url.replace('https://' + (environment.production ? Bucket.PROD : Bucket.TEST), '');
    }

    const link = ref(this.storage, url);
    return from(getMetadata(link));
  }

  public randomFileName() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c == 'x' ? r : (r & 0x3) | 0x8;
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
              const url = result
                .split('?')[0]
                .replace(
                  'firebasestorage.googleapis.com/v0/b/' +
                    (environment.production ? Bucket.PROD : Bucket.TEST) +
                    '/o',
                  environment.production ? Bucket.PROD : Bucket.TEST,
                );
              item.onSuccess(url, item.file, url);
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
