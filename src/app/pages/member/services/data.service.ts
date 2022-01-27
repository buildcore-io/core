import { Injectable } from '@angular/core';
import { SelectBoxOption } from '@components/select-box/select-box.component';
import { Award, Space } from 'functions/interfaces/models';
import { BehaviorSubject } from 'rxjs';
import { Member } from './../../../../../functions/interfaces/models/member';
import { Transaction } from './../../../../../functions/interfaces/models/transaction';
import { MemberAllianceItem } from './../../../components/member/components/member-reputation-modal/member-reputation-modal.component';

export const DEFAULT_SPACE: SelectBoxOption = {
  label: 'All spaces',
  value: 'all'
};

@Injectable()
export class DataService {
  public member$: BehaviorSubject<Member|undefined> = new BehaviorSubject<Member|undefined>(undefined);
  public awardsCompleted$: BehaviorSubject<Award[]|undefined> = new BehaviorSubject<Award[]|undefined>(undefined);
  public awardsPending$: BehaviorSubject<Award[]|undefined> = new BehaviorSubject<Award[]|undefined>(undefined);
  public badges$: BehaviorSubject<Transaction[]|undefined> = new BehaviorSubject<Transaction[]|undefined>(undefined);
  public space$: BehaviorSubject<Space[]|undefined> = new BehaviorSubject<Space[]|undefined>(undefined);
  public spaceList$: BehaviorSubject<Space[]> = new BehaviorSubject<Space[]>([]);

  public getAlliances(selectedSpaceId: string, includeAlliances: boolean): MemberAllianceItem[] {
    const out: MemberAllianceItem[] = [];
    const space: Space | undefined = this.spaceList$.value.find((s) => {
      return s.uid === selectedSpaceId;
    });

    // It self.
    if (space && selectedSpaceId !== DEFAULT_SPACE.value) {
      if (includeAlliances) {
        for (const [spaceId, values] of Object.entries(space?.alliances || {})) {
          const allianceSpace: Space | undefined = this.spaceList$.value.find((s) => {
            return s.uid === spaceId;
          });
          if (
            allianceSpace &&
            values.enabled === true
          ) {
            out.push({
              avatar: allianceSpace.avatarUrl,
              name: allianceSpace.name || allianceSpace.uid,
              totalAwards: this.member$.value?.statsPerSpace?.[allianceSpace.uid]?.awardsCompleted || 0,
              totalXp: this.member$.value?.statsPerSpace?.[allianceSpace.uid]?.totalReputation || 0
            });
          }
        }
      }

      out.push({
        avatar: space.avatarUrl,
        name: space.name || space.uid,
        totalAwards: this.member$.value?.statsPerSpace?.[space.uid]?.awardsCompleted || 0,
        totalXp: this.member$.value?.statsPerSpace?.[space.uid]?.totalReputation || 0
      });
    }

    return out;
  }

  public resetSubjects(): void {
    // Clean up all streams.
    this.member$.next(undefined);
    this.awardsCompleted$.next(undefined);
    this.awardsPending$.next(undefined);
    this.badges$.next(undefined);
    this.space$.next(undefined);
  }
}
