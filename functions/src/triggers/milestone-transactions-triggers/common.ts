import { WEN_FUNC } from "../../../interfaces/functions";
import { scale } from "../../scale.settings";

export const milestoneTriggerConfig = {
  timeoutSeconds: 300,
  minInstances: scale(WEN_FUNC.milestoneTransactionWrite),
}
