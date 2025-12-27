FROM node:24-alpine

RUN apk add --no-cache tini sqlite

WORKDIR /app

COPY dist/ ./dist/
COPY migrations/ ./migrations/
COPY node_modules/ ./node_modules/
COPY public/ ./public/
COPY vendor/complete-hsk-vocabulary/complete.min.json ./vendor/complete-hsk-vocabulary/complete.min.json
COPY docker-entrypoint.sh knexfile.ts ./

ENTRYPOINT ["/sbin/tini", "--", "/app/docker-entrypoint.sh"]