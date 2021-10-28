import * as functions from "firebase-functions";

export const createMember = functions.https.onCall((data, context) => {
  // TODO Validate input.
  functions.logger.info(context, {structuredData: true});
  return {address: data.address};
});
