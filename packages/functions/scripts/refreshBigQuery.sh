#!/bin/sh

npx @firebaseextensions/fs-bq-import-collection -P soonaverse -s transaction -q false -d soonaverse -t transaction --non-interactive -l us
npx @firebaseextensions/fs-bq-import-collection -P soonaverse -s nft -q false -d soonaverse -t nft --non-interactive -l us
npx @firebaseextensions/fs-bq-import-collection -P soonaverse -s member -q false -d soonaverse -t member --non-interactive -l us
npx @firebaseextensions/fs-bq-import-collection -P soonaverse -s space -q false -d soonaverse -t space --non-interactive -l us
