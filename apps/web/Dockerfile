# Web (Next.js) — built from the monorepo root context.
FROM node:22-slim
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY . .
RUN npm install --no-audit --no-fund
RUN npx prisma generate --schema packages/db/prisma/schema.prisma
RUN npm run build -w web

ENV NODE_ENV=production
ENV UPLOAD_DIR=/app/uploads
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "web"]
