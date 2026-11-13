FROM oven/bun:1.3.4

WORKDIR /app/api

# Install only production dependencies first to maximize layer caching.
COPY api/package.json api/bun.lock ./
RUN bun install --frozen-lockfile --production

# Copy runtime source files.
COPY api/index.ts ./
COPY api/src ./src
COPY shared /app/shared

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "run", "start"]