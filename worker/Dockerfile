FROM oven/bun:1.3.4

WORKDIR /app

# Worker executes git clone and project build commands (npm/pnpm/yarn/bun).
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    git \
    nodejs \
    npm \
    ca-certificates \
    && npm install -g corepack \
    && corepack enable \
    && rm -rf /var/lib/apt/lists/*

# Install worker production dependencies first for better layer caching.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Copy worker runtime source.
COPY index.ts ./
COPY src ./src

ENV NODE_ENV=production
ENV WORKER_TMP_DIR=/tmp/deploy-grid-worker
RUN mkdir -p /tmp/deploy-grid-worker

CMD ["bun", "run", "start"]