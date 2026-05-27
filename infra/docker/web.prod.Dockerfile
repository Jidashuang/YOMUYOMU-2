FROM node:20-alpine

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN npm ci

COPY . .

ARG NEXT_PUBLIC_API_BASE_URL=/api
ARG NEXT_PUBLIC_NLP_BASE_URL=/nlp
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_NLP_BASE_URL=${NEXT_PUBLIC_NLP_BASE_URL}

RUN npm run build:web

WORKDIR /app/apps/web

EXPOSE 3000

CMD ["npm", "run", "start", "--", "-H", "0.0.0.0", "-p", "3000"]
