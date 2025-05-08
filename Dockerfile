# syntax=docker/dockerfile:1

FROM node:18-alpine AS builder

RUN apk add --no-cache git

WORKDIR /app

ARG REPO_URL=https://github.com/Neffez/pr0game-db-ui.git
ARG REPO_BRANCH=master

RUN git clone --depth 1 --branch ${REPO_BRANCH} ${REPO_URL} .

RUN if [ -f package-lock.json ] ; then \
      npm ci ; \
    else \
      npm install ; \
    fi

ARG VITE_PB_URL
ENV VITE_PB_URL=${VITE_PB_URL}
RUN npm run build

FROM node:18-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist ./dist

ENV PORT=3000
EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
