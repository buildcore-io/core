FROM node:20

WORKDIR /search

COPY packages/database packages/database
COPY packages/interfaces packages/interfaces
COPY packages/search packages/search
COPY package-lock.json ./
COPY package.json ./

RUN npm run build:search

EXPOSE 8080

CMD [ "node", "packages/search/lib/index.js" ]
