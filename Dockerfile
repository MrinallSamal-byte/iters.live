FROM node:20-bookworm

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --omit=dev
RUN node ./node_modules/playwright/cli.js install --with-deps chromium

COPY . .

RUN mkdir -p uploads backups logs

ENV NODE_ENV=production

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s \
  CMD node -e "const port = process.env.PORT || 10000; require('http').get('http://127.0.0.1:' + port + '/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

CMD ["npm", "start"]
