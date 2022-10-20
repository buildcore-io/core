#!/bin/sh


LOCATION=us-central1 \
PROJECT_ID=soonaverse-test \
ALGOLIA_APP_ID=<APP> \
ALGOLIA_INDEX_NAME=collection \
ALGOLIA_API_KEY=<APIKEY> \
COLLECTION_PATH=collection \
GOOGLE_APPLICATION_CREDENTIALS=./<config>.json \
npx firestore-algolia-search


LOCATION=us-central1 \
PROJECT_ID=soonaverse-test \
ALGOLIA_APP_ID=<APP> \
ALGOLIA_INDEX_NAME=member \
ALGOLIA_API_KEY=<APIKEY> \
COLLECTION_PATH=member \
GOOGLE_APPLICATION_CREDENTIALS=./<config>.json \
npx firestore-algolia-search

LOCATION=us-central1 \
PROJECT_ID=soonaverse-test \
ALGOLIA_APP_ID=<APP> \
ALGOLIA_INDEX_NAME=proposal \
ALGOLIA_API_KEY=<APIKEY> \
COLLECTION_PATH=proposal \
GOOGLE_APPLICATION_CREDENTIALS=./<config>.json \
npx firestore-algolia-search

LOCATION=us-central1 \
PROJECT_ID=soonaverse-test \
ALGOLIA_APP_ID=<APP> \
ALGOLIA_INDEX_NAME=space \
ALGOLIA_API_KEY=<APIKEY> \
COLLECTION_PATH=space \
GOOGLE_APPLICATION_CREDENTIALS=./<config>.json \
npx firestore-algolia-search

LOCATION=us-central1 \
PROJECT_ID=soonaverse-test \
ALGOLIA_APP_ID=<APP> \
ALGOLIA_INDEX_NAME=award \
ALGOLIA_API_KEY=<APIKEY> \
COLLECTION_PATH=award \
GOOGLE_APPLICATION_CREDENTIALS=./<config>.json \
npx firestore-algolia-search

LOCATION=us-central1 \
PROJECT_ID=soonaverse-test \
ALGOLIA_APP_ID=<APP> \
ALGOLIA_INDEX_NAME=nft \
ALGOLIA_API_KEY=<APIKEY> \
COLLECTION_PATH=nft \
GOOGLE_APPLICATION_CREDENTIALS=./<config>.json \
npx firestore-algolia-search
