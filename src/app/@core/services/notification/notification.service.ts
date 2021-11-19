import { Injectable } from '@angular/core';
import { FirebaseError } from '@firebase/util';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { Observable } from 'rxjs';
@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  constructor(
    private notification: NzNotificationService
  ) {
    // none.
  }

  public processRequest<T>(request: Observable<T>, msg: string): Observable<T> {
    return new Observable<T>((observe) => {
      request.subscribe({
        next: (obj) => {
          // Success
          this.notification.success(msg, '');
          observe.next(obj);
        },
        error: (obj: FirebaseError) => {
          // Error
          if (obj.message) {
            this.notification.error(obj.message, '');
          } else {
            this.notification.error('Failed due random error.', '');
          }

          // Pass it.
          observe.error(obj);
        }
      })
    });
  }
}
