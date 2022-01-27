import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl } from '@angular/forms';
import { SelectBoxOption } from '../select-box.component';

@Component({
  selector: 'wen-select-box-options',
  templateUrl: './select-box-options.component.html',
  styleUrls: ['./select-box-options.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelectBoxOptionsComponent {
  @Input() value?: string;
  @Input() isOptionsOpen = false;
  @Input() optionsWrapperClasses = '';
  @Input() isSearchable = false;
  @Input() searchControl: FormControl = new FormControl('');
  @Input() options: SelectBoxOption[] = [];
  @Input() shownOptions: SelectBoxOption[] = [];
  @Input() showImages = true;
  @Input() isAvatar = false;
  @Output() onEraseClick = new EventEmitter<void>();
  @Output() onOptionClick = new EventEmitter<string>();

  public trackBy(index: number, item: SelectBoxOption): string {
    return item.value;
  }
}
