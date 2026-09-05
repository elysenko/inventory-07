FROM node:22-alpine AS builder
WORKDIR /app
# Prisma only parses this at generate time — no database is contacted during the
# build. The real URL is injected into the pod at runtime.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
# nest build exits 0 even when tsconfig rootDir is wrong and the entrypoint lands
# at dist/src/main.js, which only fails later as "Cannot find module" in the pod.
# Fail the build here instead.
RUN npm run build && test -f dist/main.js

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./
EXPOSE 3000
CMD ["node", "dist/main"]
