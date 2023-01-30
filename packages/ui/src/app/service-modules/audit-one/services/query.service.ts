import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { UntilDestroy } from '@ngneat/until-destroy';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';

export interface AuditOneResponse {
  id: string;
  status: {
    label: string;
    code: number;
  };
  isVerified: boolean;
}

export interface AuditOneResponseMember extends AuditOneResponse {
  placeholder: void;
}

export interface AuditOneResponseSpace extends AuditOneResponse {
  membersKycStatus: AuditOneResponse[];
}

// export interface AuditOneResponseCollection extends AuditOneResponse {}

// export interface AuditOneResponseToken extends AuditOneResponse {}

@UntilDestroy()
@Injectable({
  providedIn: 'any',
})
export class AuditOneQueryService {
  public apiRootUrl = 'https://api.auditone.io';
  constructor(private http: HttpClient) {}
  public getMemberStatus(id: string): Promise<AuditOneResponseMember> {
    const path = this.apiRootUrl + '/getKycStatusOfMember' + '?id=' + id;
    return <Promise<AuditOneResponseMember>>firstValueFrom(
      this.http.get(path).pipe(
        map((v) => {
          return v;
        }),
      ),
    );
  }

  public getSpaceStatus(id: string, guardians: string[]): Promise<any> {
    const path =
      this.apiRootUrl +
      '/getKycStatusOfSpace' +
      '?id=' +
      id +
      '&guardianIds=' +
      guardians.join(',');
    return <Promise<AuditOneResponseSpace>>firstValueFrom(
      this.http.get(path).pipe(
        map((v) => {
          return v;
        }),
      ),
    );
  }
}
