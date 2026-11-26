# Athenaeum

A private, self-hosted reading app for novels. Upload your books, and read them anywhere with Athenaeum.

Everything runs on your own machine. Your account, books, covers, reading progress and settings are all stored in a local PostgreSQL database, and the app makes no outside network calls.

## Features

- **Your own bookshelf**: a unique bookshelf that you can fill with your own novels.
- **Upload EPUB and PDF files**: upload PDF's and EPUB's and automatically generate the chapter lists. (DOCX and TXT support is planned.)
- **Picks up where you left off**: save your reading progress.
- **Collections**: group your novels however you want.
- **Illustrations**: not only extracts text, but also the illustrations that are included in the novels and displays them in a gallery for each chapter.

## Getting started

You need [Docker](https://www.docker.com/) and Node.js 22.

1. Copy `.env.example` to `.env` and change `POSTGRES_PASSWORD` (and the matching part of both database URLs).
2. Start everything:

    ```bash
    docker compose up
    ```

3. Open http://localhost:5173 and create an account.

To stop it, run `docker compose down`.

## Common commands

```bash
npm test                      # run all tests
npm run build                 # type-check and build
npm run user:reset-password -- you@example.com   # print a temporary password for a user
```

## Built with

React, TypeScript, Vite, Fastify, Drizzle ORM and PostgreSQL.
