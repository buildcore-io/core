import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { download } from '@core/utils/tools.utils';
import { NzUploadFile } from 'ng-zorro-antd/upload';
import Papa from 'papaparse';
import { Observable } from 'rxjs';

export enum StepType {
  GENERATE = 'Generate',
  SUBMIT = 'Submit'
}

export interface AirdropItem {
  address: string;
  member: string;
  amount: string;
  action: string;
  link: string;
}

@Component({
  selector: 'wen-airdrops',
  templateUrl: './airdrops.page.html',
  styleUrls: ['./airdrops.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AirdropsPage {

  public tableConfig = [
    { label: $localize`Member`, key: 'member' },
    { label: $localize`Address`, key: 'address' },
    { label: $localize`Amount`, key: 'amount' },
    { label: $localize`Action`, key: 'action' },
    { label: $localize`xxx`, key: 'link' },
  ];
  public data: AirdropItem[] = [];
  public fileName: string | null = null;

  constructor(
    private cd: ChangeDetectorRef
  ) { }

  public beforeCSVUpload(file: NzUploadFile): boolean | Observable<boolean> {
    if (!file) return false;
    Papa.parse(file as unknown as File, {
      skipEmptyLines: true,
      complete: (results: any) => {
        try {
          this.fileName = file.name;
          this.data =
            results.data
              .slice(1)
              .map((r: string[]) =>
                this.tableConfig
                  .map((c, index) => ({ [c.key]: r[index] }))
                  .reduce((acc, e) => ({ ...acc, ...e }), {}));
        } catch (err) {
          console.log('Error while parsing CSV file', err);
          this.fileName = null;
          this.data = [];
        }
        this.cd.markForCheck();
      }
    })
    return false;
  }

  public generateTemplate(): void {
    const fields =
      ['', ...this.tableConfig.map((r) => r.label)] as string[];

    const csv = Papa.unparse({
      fields,
      data: []
    });

    download(`data:text/csv;charset=utf-8${csv}`, 'soonaverse_airdrop_template.csv');
  }
}
