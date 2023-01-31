import { Injectable } from '@angular/core';
import { getDownloadURL, ref, Storage, uploadBytes } from '@angular/fire/storage';
import { environment } from '@env/environment';
import { Bucket, FILE_SIZES, generateRandomFileName } from '@soonaverse/interfaces';
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

  public getMetadata(url?: string): Observable<'video' | 'image'> {
    if (!url) {
      return of('image');
    }

    return of(url?.match('.mp4$') ? 'video' : 'image');
  }

  public upload(memberId: string, item: NzUploadXHRArgs): Subscription {
    const re = /(?:\.([^.]+))?$/;
    const ext = re.exec(item.file.name!)?.[1];
    const uid: string = item.file.uid;
    const filePath: string =
      memberId + '/' + uid + '/' + generateRandomFileName() + (ext ? '.' + ext : '.webp');
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
