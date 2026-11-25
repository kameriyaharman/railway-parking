FROM oven/bun:1.1
WORKDIR /app
COPY . .
ENV PORT=8080
CMD ["bun", "server/index.ts"]
