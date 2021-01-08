# This Dockerfile is for development only (to be used by docker-compose), for deployment use [designer|runner]/Dockerfile
FROM node:12-alpine3.12

ENV PORT=3000
RUN apk update
RUN apk upgrade
RUN apk add --no-cache bash

RUN mkdir -p /user/src/app
WORKDIR /usr/src/app

COPY . .

RUN yarn install
RUN yarn build:dependencies
RUN yarn designer build

CMD yarn designer start
