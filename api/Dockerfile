FROM oven/bun:1.3.4

WORKDIR /app

# Install only production dependencies first to maximize layer caching.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Copy runtime source files.
COPY index.ts ./
COPY src ./src

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "run", "start"]