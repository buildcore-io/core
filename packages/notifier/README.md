- Notifier to post pg_notify messages on pubsub

1. cd packages/notifier
2. gcloud compute scp --recurse ./ notifier:~/notifier
3. gcloud compute ssh notifier
4. install docker: https://docs.docker.com/engine/install/ubuntu/
5. cd notifier
6. docker compose up
