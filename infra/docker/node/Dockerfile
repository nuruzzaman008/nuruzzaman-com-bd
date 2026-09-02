# Next.js as a long-running Node server.
#
# Static export is not an option: authentication, checkout, the account area and
# the course player all need per-request rendering. The standalone output keeps
# the runtime image small without giving that up.
FROM node:22-alpine AS deps

WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json

RUN npm ci --ignore-scripts

FROM node:22-alpine AS builder

WORKDIR /repo

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY . .

# Public build-time values only. Secrets are read at run time by the server.
ARG NEXT_PUBLIC_SITE_URL=https://nuruzzaman.com.bd
ARG NEXT_PUBLIC_API_BASE=/api/v1
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run contracts:types \
    && npm run build --workspace @nuruzzaman/web

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD node -e "fetch('http://127.0.0.1:3000/robots.txt').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
