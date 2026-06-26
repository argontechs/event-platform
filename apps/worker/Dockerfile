# Background worker — built from the monorepo root context. Runs via tsx.
FROM node:22-slim
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY . .
RUN npm install --no-audit --no-fund
RUN npx prisma generate --schema packages/db/prisma/schema.prisma

ENV NODE_ENV=production
ENV UPLOAD_DIR=/app/uploads
CMD ["npm", "run", "start", "-w", "worker"]
