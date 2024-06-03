FROM node:20

WORKDIR /farcaster

COPY packages/farcaster .

RUN npm i
RUN npm run build

EXPOSE 8080

CMD ["node", "-r", "dotenv/config", "lib/index.js"]
