# ---- Build stage ----
FROM oven/bun:1-alpine AS builder

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# ---- Runtime dependency stage ----
FROM oven/bun:1-alpine AS deps

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production --omit=optional --omit=peer

# ---- Runtime stage ----
FROM oven/bun:1-alpine

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache ffmpeg ca-certificates

# Install mkbrr
RUN MKBRR_VERSION=$(wget -qS -O /dev/null https://github.com/autobrr/mkbrr/releases/latest 2>&1 \
        | grep -i '^ *location:' | tail -1 | grep -o '[^/]*$' | tr -d '\r' | sed 's/^v//') \
    && wget -qO- "https://github.com/autobrr/mkbrr/releases/download/v${MKBRR_VERSION}/mkbrr_${MKBRR_VERSION}_linux_x86_64.tar.gz" \
        | tar -xz -C /usr/local/bin mkbrr

# Set locale
ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8

# Copy build output and production dependencies
COPY --from=builder /app/build ./build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Create config directory
RUN mkdir -p /config

# App configuration
ENV APPDATA=/config
ENV HOME=/mnt
ENV PORT=51901
ENV ORIGIN=http://localhost:51901

EXPOSE ${PORT}

CMD ["bun", "run", "build/index.js"]
