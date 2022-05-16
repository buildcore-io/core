import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { TokenApi } from '@api/token.api';
import { AuthService } from '@components/auth/services/auth.service';
import { NotificationService } from '@core/services/notification';
import { Token } from '@functions/interfaces/models/token';

@Component({
  selector: 'wen-token-edit',
  templateUrl: './token-edit.component.html',
  styleUrls: ['./token-edit.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenEditComponent {
  @Input() isOpen = false
  @Input()
  set token(value: Token| undefined) {
    this._token = value;
    this.nameControl.setValue(this.token?.name);
    this.titleControl.setValue(this.token?.title);
    this.descriptionControl.setValue(this.token?.description);
  }
  get token(): Token | undefined {
    return this._token;
  }
  @Output() wenOnClose = new EventEmitter<void>();

  public nameControl: FormControl = new FormControl('', Validators.required);
  public titleControl: FormControl = new FormControl('', Validators.required);
  public descriptionControl: FormControl = new FormControl('', Validators.required);
  public form: FormGroup;
  private _token?: Token;

  constructor(
    private cd: ChangeDetectorRef,
    private auth: AuthService,
    private tokenApi: TokenApi,
    private notification: NotificationService
  ) {
    this.form = new FormGroup({
      name: this.nameControl,
      title: this.titleControl,
      description: this.descriptionControl
    });
  }

  public close(): void {
    this.reset();
    this.wenOnClose.next();
  }

  public reset(): void {
    this.isOpen = false;
    this.cd.markForCheck();
  }

  private validateForm(): boolean {
    this.form.updateValueAndValidity();
    if (!this.form.valid) {
      Object.values(this.form.controls).forEach((control) => {
        if (control.invalid) {
          control.markAsDirty();
          control.updateValueAndValidity({ onlySelf: true });
        }
      });

      return false;
    }

    return true;
  }

  public async saveChanges(): Promise<void> {
    if (!this.validateForm()) {
      return;
    }
    await this.auth.sign(
      { ...this.form.value, uid: this.token?.uid},
      (sc, finish) => {
        this.notification
          .processRequest(this.tokenApi.update(sc), 'Updated.', finish)
          .subscribe(() => {
            this.close();
          });
      },
    );
  }
}
