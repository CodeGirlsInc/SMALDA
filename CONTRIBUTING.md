# Contributing

Thank you for contributing!

## Steps

1. Fork the repo
2. Create a branch: `git checkout -b fix/my-change`
3. Commit and push
4. Open a Pull Request

## Code Style

Follow existing conventions. Write tests for new features.

## Reporting Issues

Include: steps to reproduce, expected behavior, environment info.

## Rust formatting

CI runs `cargo fmt --all -- --check` for `contract/`. Enable the repo hook once so it is checked before every commit:

```bash
git config core.hooksPath .githooks
```

and run `cd contract && cargo fmt --all` if it complains.
