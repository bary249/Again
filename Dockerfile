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

# Copy all necessary files and directories
COPY --from=build /app/build ./build
COPY package*.json ./
COPY src/server.mjs ./
COPY src/Game ./Game
COPY src/Components ./Components
COPY src/board.js ./
COPY src/board.css ./
COPY src/App.js ./
COPY src/index.js ./
COPY src/index.css ./
COPY public ./public

RUN npm install --production

EXPOSE 8001

CMD ["node", "server.mjs"] 