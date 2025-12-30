---
title: Choosing the tech stack
slug: /tech
---

Most of my experience with building web apps comes from opinionated frameworks such as Spring Boot or Backstage. As such, my goal with this project is to strip away too many of the "modern conveniences" that come from these frameworks. Especially as a relatively novice web developer, relying on React complexity does me no favours in learning how to build a modern web app.

The theme of this project is boring & simple tech. Nothing fancy or too "automagical". This project is also my personal hedge to get back to the basics of developing software and removing my increasingly over-reliance on tools like GitHub Copilot & ChatGPT. No agent modes, no vibe coding.

<!-- truncate -->

I've chosen the following stack to start with. This is subject to change...Obviously.

## Backend

- [Fastify](https://fastify.dev/)

Not Express? I use express all the time with Backstage development. While it works well enough, I wanted to learn another popular Node API framework with a better performance benchmarks and an emphasis on best practices for how code is organized. I've seen some really terrible Express backend code. I appreciate how Fastify's documentation immediately shares best practices for writing high quality, well-tested, and modularized production APIs.

If I ever release this publicly and it gets any sort of users, I want to ensure my backend will scale appropriately like any decent public site.

## Web

- [htmx](https://htmx.org/)
- [pico](https://picocss.com/)

Both these libraries are extremely minimal which I find attractive. This also doesn't add too many abstraction layers between the browser HTML & CSS. I ultimately want to get my head wrapped around the DOM and other key technologies.

I guess I could've just used jQuery, Bootstrap or any other number of "boring technologies".

I've read quite a bit of React code to be dangerous which encourages laziness on my part. I'd rather be closer to the metal on this one.

Pico does seem to be slower on the development side. The styling side can be swapped out with alternatives like Bootstrap, etc. in a future update so I'm not too concerned. I think the default styling looks great.

## Database

- [sqlite](https://www.sqlite.org/) (❤️)
- [postgresql](https://www.postgresql.org/)
- [knex](https://knexjs.org/)

I know Knex well because it's used heavily in Backstage. Migrations and seeding data feel very natural in a full stack Node app. Works great on both databases.

What more can be said about SQLite and Postgres that hasn't already been said? These projects are the workhorses of the Internet. I can't imagine using any other sort of database for a modern app. And since I expect my app to need quite a bit of data (full HSK 2.0 & 3.0 vocabulary lists, [Tatoeba sentence lists](https://tatoeba.org/en), user banks of custom word lists, tagging, etc).

I also think I can push an app pretty far on SQLite alone but postgres is there as my backup for a "production" environment.

## Deployment

- [nginx](https://nginx.org/)
- [Docker](https://docs.docker.com/get-started/get-docker/)\*

Can't get any more boring than that. This will likely run on DigitalOcean once it's ready to serve traffic.

:::note
Docker is only used for integration testing at the moment.
:::

## Other

I'm using a number of awesome open source or public projects for data into this project. In particular:

- [drkameleon/complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary)
- [Tatoeba](https://tatoeba.org/en)
