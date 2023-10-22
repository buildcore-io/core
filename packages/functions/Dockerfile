FROM node:18

WORKDIR api

RUN apt-get -y update
RUN apt-get -y install libudev-dev
RUN apt-get -y install cmake
RUN apt-get -y install clang
RUN apt-get -y install openssl
RUN apt-get -y install build-essential

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

COPY packages/database packages/database
COPY packages/interfaces packages/interfaces
COPY packages/functions packages/functions
COPY package.json ./

RUN npm run build:functions

EXPOSE 8080

CMD [ "node", "packages/functions/lib/index.express.js" ]
