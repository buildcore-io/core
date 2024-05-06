- Notifier to post pg_notify messages on pubsub

1. cd packages/notifier
2. gcloud compute scp --recurse ./ notifier:~/notifier
3. gcloud compute ssh notifier
4. sudo apt install npm
5. curl -o cloud-sql-proxy \
   https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.0.0/cloud-sql-proxy.linux.amd64
6. chmod +x cloud-sql-proxy
7. ./cloud-sql-proxy buildcore-prod:us-central1:buildcore &
8. sudo npm install pm2 -g
9. cd notifier && npm i && npm run build
10. pm2 start lib/index.js --name notifier
