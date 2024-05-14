/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable import/namespace */
import fs from 'fs';
import { flattenObject } from './src/common';
import { CloudFunctions } from './src/runtime/common';
import * as onScheduled from './src/runtime/cron/index';
import { ScheduledFunction } from './src/runtime/cron/scheduled';
import * as onRequests from './src/runtime/https/index';
import * as onStorage from './src/runtime/storage/index';
import * as onTriggers from './src/runtime/trigger/index';

const file = './deploy.sh';

fs.writeFileSync(file, `export GOOGLE_CLOUD_PROJECT=$(gcloud config get-value project)\n\n`);

fs.appendFileSync(
  file,
  "export PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)')\n",
);

fs.appendFileSync(file, `\n`);

const buildImage = () => {
  fs.appendFileSync(file, 'cp packages/functions/Dockerfile ./Dockerfile\n\n');
  fs.appendFileSync(file, 'gcloud builds submit --tag gcr.io/$GOOGLE_CLOUD_PROJECT/functions\n\n');
};

const deployServices = () => {
  Object.entries({
    ...flattenObject(onRequests),
    ...flattenObject(onTriggers),
    ...flattenObject(onScheduled),
    ...flattenObject(onStorage),
  }).forEach(([name, value]) => {
    const options = (value as CloudFunctions).runtimeOptions;

    let command = `gcloud run deploy ${name} \\
      --image gcr.io/$GOOGLE_CLOUD_PROJECT/functions \\
      --allow-unauthenticated \\
      --ingress=internal-and-cloud-load-balancing \\
      --add-cloudsql-instances $GOOGLE_CLOUD_PROJECT:us-central1:buildcore \\
    `;
    if (options?.region) {
      command += `  --region=${options.region} \\\n`;
    }
    if (options?.timeoutSeconds) {
      command += `      --timeout=${options.timeoutSeconds} \\\n`;
    }
    if (options?.concurrency) {
      command += `      --concurrency=${options.concurrency} \\\n`;
    }
    if (options?.memory) {
      command += `      --memory=${options.memory.replace('B', '')} \\\n`;
    }
    if (options?.minInstances) {
      command += `      --min-instances=${options.minInstances} \\\n`;
    }
    if (options?.cpu) {
      command += `      --cpu=${options.cpu} \\\n`;
    }
    fs.appendFileSync(file, command + ' &\n\n');
  });

  fs.appendFileSync(file, 'wait\n\n');
};

// const deployStorageTriggers = () => {
//   Object.entries(flattenObject(onStorage)).forEach(([name, value]) => {
//     const options = (value as CloudFunctions).runtimeOptions;
//     const command = `if [ -z "$(gcloud eventarc triggers list --filter="name:${name}" --format="value(name)")" ]; then
//       gcloud eventarc triggers create ${name} \\
//         --destination-run-service=${name} \\
//         --destination-run-path="/${name}" \\
//         --destination-run-region=${options.region} \\
//         --location=us-central1 \\
//         --event-filters="type=google.cloud.storage.object.v1.finalized" \\
//         --event-filters="bucket=${options.bucket}" \\
//         --service-account=$PROJECT_NUMBER-compute@developer.gserviceaccount.com\nfi &\n\n`;
//     fs.appendFileSync(file, command);
//     fs.appendFileSync(file, 'wait\n\n');
//   });
// };

const deployFirestoreTriggers = () => {
  Object.entries(flattenObject(onTriggers)).forEach(([name]) => {
    const command = `if ! gcloud pubsub topics list --format="value(name)" | grep -q "${name}"; then
   gcloud pubsub topics create "${name}"\nfi &\n\n`;
    fs.appendFileSync(file, command);
  });
  fs.appendFileSync(file, 'wait\n\n');
  Object.entries(flattenObject(onTriggers)).forEach(([name, value]) => {
    const options = (value as CloudFunctions).runtimeOptions;
    const command = `if [ -z "$(gcloud eventarc triggers list --filter="name:${name}" --format="value(name)")" ]; then
        gcloud eventarc triggers create ${name} \\
          --location=us-central1 \\
          --service-account=$PROJECT_NUMBER-compute@developer.gserviceaccount.com \\
          --destination-run-service=${name} \\
          --destination-run-region=${options.region} \\
          --destination-run-path="/${name}" \\
          --transport-topic=projects/$GOOGLE_CLOUD_PROJECT/topics/${name} \\
          --event-filters="type=google.cloud.pubsub.topic.v1.messagePublished"\nfi &\n\n`;
    fs.appendFileSync(file, command + '');
  });
  fs.appendFileSync(file, 'wait\n\n');
};

const deployCronTriggers = () => {
  Object.entries(flattenObject(onScheduled)).forEach(([name]) => {
    const command = `if ! gcloud pubsub topics list --format="value(name)" | grep -q "${name}"; then
   gcloud pubsub topics create "${name}"\nfi &\n\n`;
    fs.appendFileSync(file, command);
  });

  fs.appendFileSync(file, 'wait\n\n');

  Object.entries(flattenObject(onScheduled)).forEach(([name, value]) => {
    const options = (value as CloudFunctions).runtimeOptions;
    const command = `if [ -z "$(gcloud eventarc triggers list --filter="name:${name}" --format="value(name)")" ]; then
      gcloud eventarc triggers create ${name} \\
        --location=us-central1 \\
        --service-account=$PROJECT_NUMBER-compute@developer.gserviceaccount.com \\
        --transport-topic=projects/$GOOGLE_CLOUD_PROJECT/topics/${name} \\
        --destination-run-service=${name} \\
        --destination-run-region=${options.region} \\
        --destination-run-path="/${name}" \\
        --event-filters="type=google.cloud.pubsub.topic.v1.messagePublished"\nfi &\n\n`;
    fs.appendFileSync(file, command);
  });

  fs.appendFileSync(file, 'wait\n\n');

  Object.entries(flattenObject(onScheduled)).forEach(([name, value]) => {
    const schedule = (value as ScheduledFunction).schedule;
    const command = `if [ -z "$(gcloud scheduler jobs list --location=us-central1 --filter="name:${name}" --format="value(name)")" ]; then
      gcloud scheduler jobs create pubsub ${name} \\
        --schedule="${schedule}" \\
        --location=us-central1 \\
        --topic=projects/$GOOGLE_CLOUD_PROJECT/topics/${name} \\
        --message-body="{}"\nfi &\n\n`;
    fs.appendFileSync(file, command);
  });

  fs.appendFileSync(file, 'wait\n\n');
};

const setMaxAckDeadline = () => {
  fs.appendFileSync(
    file,
    `for SUBSCRIPTION_NAME in $(gcloud pubsub subscriptions list --format="value(name)" | grep -v 'subs-onupsert')\n`,
  );
  fs.appendFileSync(file, `do\n`);
  fs.appendFileSync(
    file,
    `   gcloud pubsub subscriptions update $SUBSCRIPTION_NAME --ack-deadline=600 --min-retry-delay=600 &\n`,
  );
  fs.appendFileSync(file, `done\n`);
  fs.appendFileSync(file, `wait\n`);
};

const createUpsertTopic = () => {
  const command = `if ! gcloud pubsub topics list --format="value(name)" | grep -q onupsert; then
   gcloud pubsub topics create onupsert\nfi \n\n`;
  fs.appendFileSync(file, command);
};

buildImage();
deployServices();
// deployStorageTriggers();
deployFirestoreTriggers();
deployCronTriggers();
createUpsertTopic();
setMaxAckDeadline();
