FROM node:22-alpine

WORKDIR /app

COPY package.json server.js ./
COPY lib/ ./lib/
COPY public/ ./public/

RUN chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/server-info || exit 1

CMD ["node", "server.js"]
