FROM node:24-alpine AS build

WORKDIR /src

COPY package.json package-lock.json tsconfig.json knexfile.ts ./
COPY src/ ./src/

RUN apk add --no-cache --virtual .gyp python3 make g++ \
  && npm ci \
  && npm run build \
  && apk del .gyp

FROM node:24-alpine

RUN apk add --no-cache tini sqlite

WORKDIR /app

COPY --from=build /src/dist/ ./dist/
COPY --from=build /src/node_modules/ ./node_modules/
COPY public/ ./public/
COPY views/ ./views/
COPY migrations/ ./migrations/
COPY seeds/ ./seeds/

# vendor files are symlinks in the source repo, so we need to copy them individually
COPY vendor/htmx/dist/htmx.min.js ./vendor/htmx/dist/htmx.min.js
COPY vendor/pico/css/pico.slate.min.css ./vendor/pico/css/pico.slate.min.css
COPY vendor/complete-hsk-vocabulary/complete.min.json ./vendor/complete-hsk-vocabulary/complete.min.json

COPY docker-entrypoint.sh knexfile.ts ./

ENTRYPOINT ["/sbin/tini", "--", "/app/docker-entrypoint.sh"]