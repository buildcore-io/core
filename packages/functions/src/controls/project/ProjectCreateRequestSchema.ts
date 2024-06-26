import { ProjectBilling, ProjectCreateRequest } from '@buildcore/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

const MIN_PROJECT_NAME_LENGTH = 3;
const MAX_PROJECT_NAME_LENGTH = 40;
export const projectCreateSchema = toJoiObject<ProjectCreateRequest>({
  name: Joi.string()
    .min(MIN_PROJECT_NAME_LENGTH)
    .max(MAX_PROJECT_NAME_LENGTH)
    .required()
    .description(
      `Name of the project. Minimum ${MIN_PROJECT_NAME_LENGTH}, maximum ${MAX_PROJECT_NAME_LENGTH} character`,
    ),
  contactEmail: Joi.string().email().description('Email address of a contact for the project.'),
  config: Joi.object({
    billing: Joi.string()
      .valid(...Object.values(ProjectBilling))
      .required()
      .description('Billing type of the project.'),
    tiers: Joi.array()
      .when('billing', {
        is: Joi.exist().valid(ProjectBilling.TOKEN_BASED),
        then: Joi.array().items(Joi.number().integer().min(0)).min(5).max(5).required(),
        otherwise: Joi.forbidden(),
      })
      .description(
        `Tiers for this project. Set only if billing type is ${ProjectBilling.TOKEN_BASED}`,
      ),
    tokenTradingFeeDiscountPercentage: Joi.array()
      .when('billing', {
        is: Joi.exist().valid(ProjectBilling.TOKEN_BASED),
        then: Joi.array().items(Joi.number().integer().min(0)).min(5).max(5).required(),
        otherwise: Joi.forbidden(),
      })
      .description(
        `Discounts for this project. Set only if billing type is ${ProjectBilling.TOKEN_BASED}`,
      ),
    nativeTokenSymbol: Joi.string()
      .when('billing', {
        is: Joi.exist().valid(ProjectBilling.TOKEN_BASED),
        then: CommonJoi.tokenSymbol(),
        otherwise: Joi.forbidden(),
      })
      .description(
        `Base token symbol for this project. Set only if billing type is ${ProjectBilling.TOKEN_BASED}`,
      ),
  })
    .required()
    .description('Config for this project.'),
})
  .description('Request object to create a project.')
  .meta({
    className: 'ProjectCreateRequest',
  });
