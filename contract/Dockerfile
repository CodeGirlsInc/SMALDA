# syntax=docker/dockerfile:1.7
# Multi-stage Dockerfile for the stellar-doc-verifier (Rust / Axum) service.
#
# Build:   docker build -f contract/Dockerfile -t stellar-doc-verifier:local .
# Run:     docker run -p 8080:8080 \
#              -e STELLAR_SECRET_KEY=S... \
#              -e REDIS_URL=redis://host.docker.internal:6379 \
#              stellar-doc-verifier:local

# Base toolchain stage: install cargo-chef for reproducible dependency caching.
FROM rust:1.75-slim-bookworm AS chef
RUN cargo install --locked cargo-chef
WORKDIR /build
ENV CARGO_TERM_COLOR=always

# Planner: produce a recipe.json describing the dependency graph so the cook
# stage can rebuild the dep cache independently of the source code.
FROM chef AS planner
COPY contract/ /build/contract/
RUN cargo chef prepare --recipe-path /build/contract/recipe.json \
        --bin stellar-doc-verifier

# System build deps live with the builder so they're cached separately.
FROM chef AS system-deps
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        pkg-config \
        libssl-dev \
        libsodium-dev \
        ca-certificates \
        cmake \
    && rm -rf /var/lib/apt/lists/*

# Builder: cook the dep cache, then build the real binary.
FROM system-deps AS builder
ARG BUILD_PROFILE=release
COPY --from=planner /build/contract/recipe.json /build/contract/recipe.json
WORKDIR /build/contract
RUN cargo chef cook --${BUILD_PROFILE} --locked \
        --recipe-path /build/contract/recipe.json \
        --bin stellar-doc-verifier
COPY contract/ /build/contract/
RUN cargo build --${BUILD_PROFILE} --locked --bin stellar-doc-verifier

# Minimal runtime image: no compilers, no headers, no docs. Runs as non-root.
FROM debian:bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        libsodium23 \
        libssl3 \
        tini \
        wget \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 stellar \
    && useradd  --system --uid 1001 --gid stellar --create-home --shell /usr/sbin/nologin stellar

COPY --from=builder /build/contract/target/release/stellar-doc-verifier \
                    /usr/local/bin/stellar-doc-verifier

USER stellar
WORKDIR /home/stellar

ENV RUST_LOG=info \
    PORT=8080 \
    APP_ENV=production

EXPOSE 8080

# Container-level healthcheck pings the service's /health endpoint (CT-60).
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -qO- "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1 || exit 1

# tini forwards signals as PID 1 so SIGTERM reaches the Rust process cleanly.
ENTRYPOINT ["/usr/bin/tini","--"]
CMD ["stellar-doc-verifier"]
