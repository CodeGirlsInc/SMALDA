# Docker — cmmty contract service

## Build

```bash
# from contract/cmmty/
docker build -f docker/Dockerfile -t cmmty .
```

## Run with docker compose

```bash
cd docker
docker compose up
```

The service starts on `http://localhost:3002`.

| Endpoint | Description |
|---|---|
| `GET /health` | Liveness check |
| `GET /cmmty/docs` | Swagger UI |
| `GET /cmmty/openapi.json` | Raw OpenAPI spec |
| `GET /cmmty/events/:hash` | Event stream for a hash |

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `REDIS_URL` | `redis://127.0.0.1:6379` | Redis connection string |
| `PORT` | `3002` | Listening port |
| `RUST_LOG` | `info` | Log level |
