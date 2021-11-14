import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@components/auth/services/auth.service';
import { getUrlValidator } from '@core/utils/form-validation.utils';
import { undefinedToEmpty } from '@core/utils/manipulations.utils';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import Web3Token from 'web3-token';
import { SpaceApi } from './../../../../@api/space.api';
import { MetamaskSignature } from './../../../../components/auth/services/auth.service';

@Component({
  selector: 'wen-new',
  templateUrl: './new.page.html',
  styleUrls: ['./new.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewPage {
  public nameControl: FormControl = new FormControl('');
  public aboutControl: FormControl = new FormControl('');
  public discordControl: FormControl = new FormControl('', getUrlValidator());
  public twitterControl: FormControl = new FormControl('', getUrlValidator());
  public githubControl: FormControl = new FormControl('', getUrlValidator());
  public spaceForm: FormGroup;

  constructor(
    private auth: AuthService,
    private router: Router,
    private spaceApi: SpaceApi,
    private notification: NzNotificationService
  ) {
    this.spaceForm = new FormGroup({
      name: this.nameControl,
      about: this.aboutControl,
      discord: this.discordControl,
      twitter: this.twitterControl,
      github: this.githubControl
    });
  }

  public async create(): Promise<void> {
    this.spaceForm.updateValueAndValidity();
    if (!this.spaceForm.valid) {
      return;
    }

    const sc: MetamaskSignature|undefined =  await this.auth.signWithMetamask(
      undefinedToEmpty(this.spaceForm.value)
    );

    if (!sc) {
      throw new Error('Unable to sign.');
    }

    console.log(sc);
    console.log(await Web3Token.verify(sc.token));
    // TODO Handle this via queue and clean-up.
    this.spaceApi.createSpace(sc.token).subscribe((val) => {
      this.notification.success('Created.', '');
      this.router.navigate([ROUTER_UTILS.config.space.root, val?.uid])
    });
  }

  public get urlToSpaces(): string {
    return '/' + ROUTER_UTILS.config.discover.root + '/' + ROUTER_UTILS.config.discover.spaces;
  }
}
