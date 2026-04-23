# ── builder ──────────────────────────────────────────────────────────────────
FROM rust:1.78-slim AS builder

WORKDIR /app

# Cache dependencies
COPY Cargo.toml Cargo.lock* ./
RUN mkdir src && echo "fn main(){}" > src/main.rs
RUN cargo build --release 2>/dev/null || true
RUN rm -rf src

COPY src ./src
RUN cargo build --release

# ── runtime ──────────────────────────────────────────────────────────────────
FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/cmmty /usr/local/bin/cmmty

ENV RUST_LOG=info
ENV PORT=3002

EXPOSE 3002

ENTRYPOINT ["cmmty"]
