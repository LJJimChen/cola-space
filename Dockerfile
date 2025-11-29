FROM mcr.microsoft.com/playwright:v1.48.0-jammy
WORKDIR /app
COPY package.json package.json
RUN npm i --only=prod
COPY tsconfig.json tsconfig.json
COPY src src
COPY data-sample/sample.yml data-sample/sample.yml
RUN npm run build
ENV PORT=3000
ENV HEADLESS=true
CMD ["npm","run","start"]
