FROM node:20-alpine

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN npm ci

COPY . .

WORKDIR /app/apps/web
CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0", "-p", "3000"]
