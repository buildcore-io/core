import { Pipe, PipeTransform } from '@angular/core';
import * as dayjs from 'dayjs';
import * as relativeTime from 'dayjs/plugin/relativeTime';
import * as updateLocale from 'dayjs/plugin/updateLocale';
import { Timestamp } from "functions/interfaces/models/base";
dayjs.extend(relativeTime);
dayjs.extend(updateLocale)
dayjs.updateLocale('en', {
  relativeTime: {
    future: "in %s",
    past: "%s ago",
    s: 'in %d seconds',
    m: "a minute",
    mm: "%d minutes",
    h: "an hour",
    hh: "%d hours",
    d: "a day",
    dd: "%d days",
    M: "a month",
    MM: "%d months",
    y: "a year",
    yy: "%d years"
  }
});

@Pipe({
  pure: false,
  name: 'relativeTime',
})
export class RelativeTime implements PipeTransform {
  transform(date: dayjs.Dayjs|Timestamp|null): string {
    if (!date) {
      return '';
    }


    return dayjs(date.toDate()).fromNow();
  }
}
