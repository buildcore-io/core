import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'uknownIfZero'
})
export class UknownIfZeroPipe implements PipeTransform {
  transform(value: string): any {
    if (!(parseFloat(value) < 0 || parseFloat(value) > 0)) {
      return '-';
    } else {
      return value;
    }
  }
}
