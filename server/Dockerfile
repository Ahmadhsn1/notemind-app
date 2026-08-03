# syntax=docker/dockerfile:1
FROM node:24-alpine

# dumb-init makes PID 1 forward signals properly. Without it, SIGTERM from the
# platform never reaches Node and the graceful shutdown in server.js is dead
# code — the container just gets SIGKILLed after the grace period.
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production
WORKDIR /app

# Copy manifests first so `npm ci` is cached and only re-runs when
# dependencies actually change, not on every source edit.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Never run as root. The node image ships a non-root `node` user; uploads/ is
# chowned because the local-disk fallback writes there (production uses R2,
# but a misconfigured deploy should fail loudly, not on a permission error).
RUN mkdir -p uploads && chown -R node:node /app
USER node

EXPOSE 5000

# The platform health check should target /healthz; this HEALTHCHECK is for
# plain `docker run` and compose.
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||5000)+'/healthz',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
