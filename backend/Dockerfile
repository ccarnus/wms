FROM node:20-alpine

WORKDIR /usr/src/app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY src ./src

EXPOSE 3000

CMD ["sh", "-c", "npm run seed:users && npm run seed:testdata && npm start"]
