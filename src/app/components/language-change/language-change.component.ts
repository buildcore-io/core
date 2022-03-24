import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl } from '@angular/forms';

export const Languages = ['EN', 'CS', 'DE', 'ES', 'FR', 'IT', 'JA', 'KO', 'NL', 'PL', 'PT-BR', 'PT-PT'];

@Component({
  selector: 'wen-language-change',
  templateUrl: './language-change.component.html',
  styleUrls: ['./language-change.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LanguageChangeComponent {

  public languages = Languages;
  public languageControl: FormControl;

  constructor() {
    this.languageControl = new FormControl(this.languages[0]);
  }
}
