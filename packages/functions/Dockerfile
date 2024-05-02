FROM node:20

WORKDIR /functions

COPY packages/database packages/database
COPY packages/interfaces packages/interfaces
COPY packages/functions packages/functions
COPY package.json ./

RUN npm run build:functions

EXPOSE 8080

CMD [ "node", "packages/functions/lib/index.js" ]
