FROM mcr.microsoft.com/playwright:v1.48.0-jammy
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY data-sample/sample.yml ./data-sample/sample.yml
RUN npm run build
CMD ["npm","run","start"]
