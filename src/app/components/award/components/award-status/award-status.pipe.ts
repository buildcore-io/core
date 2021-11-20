import { Pipe, PipeTransform } from '@angular/core';
import { AwardType } from '../../../../../../functions/interfaces/models/award';

@Pipe({
  name: 'statusPrint',
})
export class AwardStatusPrintPipe implements PipeTransform {
  transform(type?: AwardType): string {
    if (type === AwardType.PARTICIPATE_AND_APPROVE) {
      return 'Basic';
    } if (type === AwardType.DISCORD_ACTIVITY) {
      return 'Discord Activity';
    } if (type === AwardType.GITHUB_ACTIVITY) {
      return 'Github Activity';
    } else {
      return 'Custom';
    }
  }
}
