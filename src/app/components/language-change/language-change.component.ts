import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { CookieItem, getCookie, setCookie } from '@core/utils/cookie.utils';
import { Languages } from '@core/utils/language.util';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy()
@Component({
  selector: 'wen-language-change',
  templateUrl: './language-change.component.html',
  styleUrls: ['./language-change.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LanguageChangeComponent implements OnInit {

  public languages = Object.values(Languages);
  public languageControl: FormControl = new FormControl(getCookie(CookieItem.firebaseLanguageOverride) || this.languages[0].firebase);

  ngOnInit(): void {
    let prevLang = this.languageControl.value;
    this.languageControl.valueChanges
      .pipe(untilDestroyed(this))
      .subscribe((firebaseLang: string) => {
        if (prevLang !== firebaseLang) {
          setCookie(CookieItem.firebaseLanguageOverride, firebaseLang);
          setTimeout(() => {
            window.location.reload();
          }, 750);
          prevLang = firebaseLang;
        }
      });
  }


}
