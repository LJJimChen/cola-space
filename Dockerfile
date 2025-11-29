FROM mcr.microsoft.com/playwright:v1.48.0-jammy AS build
WORKDIR /app
COPY package.json package.json
COPY package-lock.json package-lock.json
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci
COPY tsconfig.json tsconfig.json
COPY src src
COPY data-sample/sample.yml sample.yml
RUN npm run build

FROM mcr.microsoft.com/playwright:v1.48.0-jammy AS runner
WORKDIR /app
COPY package.json package.json
COPY package-lock.json package-lock.json
COPY --from=build /app/dist dist
COPY --from=build /app/sample.yml sample.yml
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci --omit=dev
ENV PORT=3000
ENV CRON_ENABLED=true
ENV HEADLESS=true
ENV INIT_REFRESH=false
ENV ENABLE_HTTPS=false
ENV HTTPS_KEY_PATH=
ENV HTTPS_CERT_PATH=
ENV API_KEY=
ENV STEP_DELAY_MS=1000
ENV COFFEE_BASE_URL=https://咖啡云.com
CMD ["npm","run","start"]
