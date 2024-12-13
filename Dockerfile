# Build stage
FROM node:18 as build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN CI=false npm run build

# Production stage
FROM node:18-slim

WORKDIR /app

COPY --from=build /app/build ./build
COPY package*.json ./
COPY src/server.mjs ./
RUN npm install --production

EXPOSE 8001

CMD ["node", "server.mjs"] 