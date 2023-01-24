import { Injectable } from '@angular/core';
import { Award } from '@soonaverse/interfaces';
import dayjs from 'dayjs';

@Injectable({
  providedIn: 'root',
})
export class HelperService {
  public getExperiencePointsPerBadge(award: Award | undefined | null): number {
    if (award?.badge?.xp && award.badge.xp > 0 && award?.badge?.count > 1) {
      return (award.badge.xp || 0) / (award.badge.count || 0);
    } else {
      return award?.badge?.xp || 0;
    }
  }

  public isCompleted(award: Award | undefined | null): boolean {
    if (!award) {
      return false;
    }

    return (
      award.issued >= award.badge.count ||
      (dayjs(award?.endDate.toDate()).isBefore(dayjs()) && award.approved)
    );
  }

  public getShareUrl(award?: Award | null): string {
    return award?.wenUrl || window?.location.href;
  }
}
