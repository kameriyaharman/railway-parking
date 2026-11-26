FROM oven/bun:1
WORKDIR /app
COPY server ./server
COPY web ./web
COPY package.json ./
ENV PORT=8080
CMD ["bun", "server/index.ts"]
