import { Pipe, PipeTransform } from '@angular/core';
import bigDecimal from 'js-big-decimal';

@Pipe({
  name: 'unknownIfInfinity'
})
export class UnknownIfInfinityPipe implements PipeTransform {
  transform(value?: string | null, isPercent = false): any {
    let result;
    if (value === '∞' || value === 'Infinity') {
      result = `-${isPercent ? '%': ''}`;
    } else {
      result = `${isPercent ? bigDecimal.round(bigDecimal.multiply(value, 100), 2).toString() : value}${isPercent ? '%': ''}`;;
    }
    return result;
  }
}
