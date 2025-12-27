#!/usr/bin/env sh
./node_modules/.bin/knex migrate:latest
exec node ./dist/index.js "$@"
