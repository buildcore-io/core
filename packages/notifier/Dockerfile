FROM node:20

WORKDIR /notifier

COPY . .

RUN npm i
RUN npm run build

CMD ["node", "-r", "dotenv/config", "lib/index.js"]
