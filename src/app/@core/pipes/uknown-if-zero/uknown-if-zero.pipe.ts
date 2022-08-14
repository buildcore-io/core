import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'uknownIfZero'
})
export class UknownIfZeroPipe implements PipeTransform {
  transform(value: string): any {
    if (!(parseInt(value) < 0 && parseInt(value) > 0)) {
      return '-';
    } else {
      return value;
    }
  }
}
