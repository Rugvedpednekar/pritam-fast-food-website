FROM oven/bun:1-alpine
WORKDIR /app

# Dependencies are Bun built-ins; no npm packages are required.
COPY package.json ./
COPY src ./src

ENV NODE_ENV=production
EXPOSE 3000

CMD ["bun", "run", "start"]
