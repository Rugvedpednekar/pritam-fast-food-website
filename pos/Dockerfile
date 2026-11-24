FROM oven/bun:1-alpine
WORKDIR /app

# Dependencies are Bun built-ins; no npm packages are required.
COPY package.json ./
COPY src ./src
COPY tests ./tests

# Fail the build if core business-day, payroll, or restaurant validation tests fail.
RUN bun test

ENV NODE_ENV=production
EXPOSE 3000

CMD ["bun", "run", "start"]
