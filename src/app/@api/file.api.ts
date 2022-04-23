import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireStorage, AngularFireStorageReference, AngularFireUploadTask } from "@angular/fire/compat/storage";
import { NzUploadFile, NzUploadXHRArgs } from "ng-zorro-antd/upload";
import { finalize, Observable, Subscription } from 'rxjs';
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

  constructor(protected afs: AngularFirestore, private storage: AngularFireStorage) {
    // none.
  }

  public static getUrl(org: string, type: FileType, size: FILE_SIZES): string {
    return org.replace(type, type + '_' + FileApi.FILE_SIZES[size]);
  }

  public getMetadata(url: string): Observable<any> {
    const ref: AngularFireStorageReference = this.storage.refFromURL(url);
    return ref.getMetadata();
  }

  public upload(memberId: string, item: NzUploadXHRArgs, type: FileType): Subscription {
    const file: NzUploadFile = item.file;
    const uid: string = file.uid;
    const filePath: string = memberId + '/' + uid + '/' + type;
    const fileRef: AngularFireStorageReference = this.storage.ref(filePath);
    const task: AngularFireUploadTask = this.storage.upload(filePath, file);

    /**
     * Task is uploaded into Firebase storage which converts into various formats.
     * Uploads it into IPFS and pin it.
     */
    return task.snapshotChanges().pipe(
      finalize(() => {
        fileRef.getDownloadURL().subscribe((result) => {
          if (item.onSuccess) {
            item.onSuccess(result, item.file, result);
          } else {
            throw new Error('Unable to upload image due missing handler.');
          }
        });
      })
    ).subscribe({
      next: (result) => {
        if (result && item.onProgress) {
          const event = { percent: 0 };
          event.percent = (result.bytesTransferred / result.totalBytes) * 100;
          item.onProgress(event, item.file);
        }
      },
      error: (err) => {
        if (item.onError) {
          item.onError(err, item.file);
        }
      }
    });
  }
}
