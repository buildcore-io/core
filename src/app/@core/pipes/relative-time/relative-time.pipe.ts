import { Pipe, PipeTransform } from '@angular/core';
import * as dayjs from 'dayjs';
import * as relativeTime from 'dayjs/plugin/relativeTime';
import { Timestamp } from "functions/interfaces/models/base";
dayjs.extend(relativeTime);

@Pipe({
  name: 'relativeTime',
})
export class RelativeTime implements PipeTransform {
  transform(date: Timestamp): string {
    if (!date) {
      return '';
    }


    return dayjs(date.toDate()).fromNow();
  }
}
