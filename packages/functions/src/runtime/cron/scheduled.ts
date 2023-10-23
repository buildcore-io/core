import { CloudFunctions, RuntimeOptions } from '../common';

export class ScheduledFunction extends CloudFunctions {
  constructor(
    public readonly schedule: string,
    public readonly func: () => Promise<unknown>,
    options?: RuntimeOptions,
  ) {
    super({
      region: 'us-central1',
      ...options,
    });
  }
}

export const onSchedule = (params: {
  schedule: string;
  runtimeOptions?: RuntimeOptions;
  handler: () => Promise<unknown>;
}) => new ScheduledFunction(params.schedule, params.handler, params.runtimeOptions);
