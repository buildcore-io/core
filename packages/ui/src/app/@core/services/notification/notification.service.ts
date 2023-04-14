import { Injectable } from '@angular/core';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  constructor(private notification: NzNotificationService) {
    // none.
  }

  public processRequest<T>(request: Observable<T>, msg: string, cb: any): Observable<T> {
    return new Observable<T>((observe) => {
      request.subscribe({
        next: (obj) => {
          // Success
          this.notification.success(msg, '');
          cb();
          observe.next(obj);
        },
        error: (obj: any) => {
          // Error
          if (obj?.error?.data?.message) {
            this.notification.error(obj.message, '');
          } else {
            this.notification.error('Failed due random error.', '');
          }

          // Pass it.
          cb();
          observe.error(obj);
        },
      });
    });
  }
}
