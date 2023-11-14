FROM node:20

WORKDIR /api

COPY packages/database packages/database
COPY packages/interfaces packages/interfaces
COPY packages/api packages/api
COPY package-lock.json ./
COPY package.json ./

RUN npm run build:api

EXPOSE 8080

CMD [ "node", "packages/api/lib/index.js" ]
