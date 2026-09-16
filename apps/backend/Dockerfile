FROM node:22-alpine AS builder

WORKDIR /app
RUN npm install -g pnpm

COPY pnpm-workspace.yaml package.json ./
COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend

RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @tienda/shared build
RUN pnpm --filter backend build

FROM node:22-alpine AS runner
WORKDIR /app
RUN npm install -g pnpm

COPY pnpm-workspace.yaml package.json ./
COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist

RUN pnpm install --prod --frozen-lockfile=false

WORKDIR /app/apps/backend
EXPOSE 3000
CMD ["node", "dist/server.js"]
