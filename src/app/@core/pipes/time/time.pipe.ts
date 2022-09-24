import { Pipe, PipeTransform } from '@angular/core';
import dayjs from 'dayjs';
import { Timestamp } from "functions/interfaces/models/base";

@Pipe({
  pure: false,
  name: 'Time',
})
export class Time implements PipeTransform {
  transform(date: dayjs.Dayjs|Timestamp|null): string {
    if (!date || !date.toDate) {
      return '--:--:--';
    }

    return dayjs(date.toDate()).format('HH:mm:ss');
  }
}
