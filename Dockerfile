FROM node:24-alpine

RUN apk add --no-cache tini sqlite

WORKDIR /app

COPY dist/ ./dist/
COPY node_modules/ ./node_modules/
COPY public/ ./public/
COPY docker-entrypoint.sh ./

ENTRYPOINT ["/sbin/tini", "--", "/app/docker-entrypoint.sh"]