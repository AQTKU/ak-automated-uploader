# ---- Build stage ----
FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# ---- Runtime stage ----
FROM oven/bun:1

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    locales \
    ca-certificates \
    curl \
    && sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen \
    && locale-gen \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install mkbrr from .deb
RUN MKBRR_VERSION=$(curl -fsSL -o /dev/null -w '%{url_effective}' \
        https://github.com/autobrr/mkbrr/releases/latest \
        | grep -o '[^/]*$' | sed 's/^v//') \
    && curl -fsSL "https://github.com/autobrr/mkbrr/releases/download/v${MKBRR_VERSION}/mkbrr_${MKBRR_VERSION}_linux_amd64.deb" \
        -o /tmp/mkbrr.deb \
    && dpkg -i /tmp/mkbrr.deb \
    && rm /tmp/mkbrr.deb

# Set locale
ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8

# Copy build output and node_modules (safety net)
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
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
