import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireStorage, AngularFireStorageReference, AngularFireUploadTask } from "@angular/fire/compat/storage";
import { File } from 'functions/interfaces/models/file';
import { NzUploadFile, NzUploadXHRArgs } from "ng-zorro-antd/upload";
import { finalize, Subscription } from 'rxjs';
import { BaseApi } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class FileApi extends BaseApi<File> {
  public collection = 'upload';
  constructor(protected afs: AngularFirestore, private storage: AngularFireStorage) {
    super(afs);
  }

  public upload(memberId: string, item: NzUploadXHRArgs): Subscription {
    const file: NzUploadFile = item.file;
    const uid: string = file.uid;
    const filePath: string = memberId + '/' + uid;
    const fileRef: AngularFireStorageReference = this.storage.ref(filePath);
    const task: AngularFireUploadTask = this.storage.upload(filePath, file);

    /**
     * Task is uploaded into Firebase storage which converts into various formats.
     * Uploads it into IPFS and pin it.
     */
    return task.snapshotChanges().pipe(
      finalize(() => {
        fileRef.getDownloadURL().subscribe((result) => {
          // No we need to listen to Firebase storage.
          this.listen(uid).subscribe((obj) => {
            if (item.onSuccess) {
              // wait for IPFS link.
              item.onSuccess(result, item.file, result);
            } else {
              throw new Error('Unable to upload image due missing handler.');
            }
          });
        });
      })
    ).subscribe(
        (result) => {
          if (result && item.onProgress) {
            const event = { percent: 0};
            event.percent = (result.bytesTransferred / result.totalBytes) * 100;
            item.onProgress(event, item.file);
          }
        },
        (err) => {
          if (item.onError) {
            item.onError(err, item.file);
          }
        }
      );
  }
}
