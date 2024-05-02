import { Project, ProjectBilling, ProjectOtr } from '@buildcore/interfaces';
import { Converter } from '../../interfaces/common';
import { PgProject } from '../../models';
import { removeNulls } from '../common';
import { pgDateToTimestamp } from '../postgres';

export class ProjectConverter implements Converter<Project, PgProject> {
  toPg = (project: Project): PgProject => ({
    uid: project.uid,
    createdOn: project.createdOn?.toDate(),
    updatedOn: project.updatedOn?.toDate(),
    createdBy: project.createdBy,
    name: project.name,
    contactEmail: project.contactEmail,
    deactivated: project.deactivated,
    config_billing: project.config?.billing,
    config_tiers: project.config?.tiers,
    config_tokenTradingFeeDiscountPercentage: project.config?.tokenTradingFeeDiscountPercentage,
    config_nativeTokenSymbol: project.config?.nativeTokenSymbol,
    config_nativeTokenUid: project.config?.nativeTokenUid,
    otr: JSON.stringify(project.otr || {}) as any,
  });

  fromPg = (project: PgProject): Project =>
    removeNulls({
      uid: project.uid,
      createdOn: pgDateToTimestamp(project.createdOn),
      updatedOn: pgDateToTimestamp(project.updatedOn),
      createdBy: project.createdBy,
      name: project.name || '',
      contactEmail: project.contactEmail,
      deactivated: project.deactivated,
      config: {
        billing: project.config_billing as ProjectBilling,
        tiers: project.config_tiers,
        tokenTradingFeeDiscountPercentage: project.config_tokenTradingFeeDiscountPercentage,
        nativeTokenSymbol: project.config_nativeTokenSymbol,
        nativeTokenUid: project.config_nativeTokenUid,
      },
      otr: project.otr as unknown as { [key: string]: ProjectOtr },
    });
}
