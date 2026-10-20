# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build

WORKDIR /app

# Copy workspace manifests first so dependency installation remains cacheable.
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json

RUN npm ci --ignore-scripts

COPY server ./server
RUN npm run build -w server


FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json

# Install only the server's production dependencies from the monorepo lockfile.
RUN npm ci --omit=dev --workspace=@ceova/server \
      --include-workspace-root=false --ignore-scripts \
    && npm cache clean --force

COPY --from=build /app/server/dist ./server/dist

RUN chown -R node:node /app
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server/dist/index.js"]
