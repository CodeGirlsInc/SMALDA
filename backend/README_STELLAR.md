# Stellar Module Configuration

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_NAME=smalda

# Stellar Configuration
STELLAR_DEFAULT_NETWORK=testnet
STELLAR_TESTNET_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_TESTNET_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
STELLAR_TESTNET_FRIENDBOT_URL=https://friendbot.stellar.org
STELLAR_MAINNET_HORIZON_URL=https://horizon.stellar.org
STELLAR_MAINNET_NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"

# Stellar Fees and Timeouts
STELLAR_BASE_FEE=100
STELLAR_MAX_FEE=1000
STELLAR_TRANSACTION_TIMEOUT=30000
STELLAR_POLLING_TIMEOUT=60000
STELLAR_CONFIRMATION_TIMEOUT=120000
STELLAR_RETRY_ATTEMPTS=3
STELLAR_RETRY_DELAY=1000

# Application
NODE_ENV=development
```

## Database Setup

Ensure PostgreSQL is running and create the database:

```sql
CREATE DATABASE smalda;
```

The application will automatically create the necessary tables (`stellar_transactions` and `stellar_accounts`) on startup in development mode.

## Running the Application

```bash
# Install dependencies
npm install

# Start in development mode
npm run start:dev

# Build for production
npm run build
npm run start:prod
```

## API Documentation

Once the application is running, visit `http://localhost:3000/api` to see the Swagger documentation.

## Testing

```bash
# Run unit tests
npm run test

# Run e2e tests
npm run test:e2e

# Run with coverage
npm run test:cov
```

## Features Implemented

### Core Functionality
- ✅ Create and fund Stellar accounts
- ✅ Anchor document hashes as memo fields
- ✅ Record verification timestamps
- ✅ Store transaction references in database
- ✅ Handle testnet and mainnet configurations
- ✅ Transaction status polling
- ✅ Error handling for failed transactions
- ✅ Cost estimation before submission
- ✅ Batch transaction support

### API Endpoints
- `POST /stellar/accounts` - Create new Stellar account
- `POST /stellar/accounts/fund` - Fund account (testnet only)
- `GET /stellar/accounts/:publicKey/balance` - Get account balance
- `POST /stellar/estimate-fee` - Estimate transaction fee
- `POST /stellar/anchor` - Anchor single document hash
- `POST /stellar/anchor/batch` - Anchor multiple document hashes
- `GET /stellar/transactions/:hash/status` - Poll transaction status
- `GET /stellar/transactions/:hash` - Get transaction details
- `GET /stellar/transactions/document/:hash` - Get transactions by document hash
- `POST /stellar/verify` - Verify document on Stellar

### Security & Validation
- ✅ Input validation and sanitization
- ✅ Rate limiting
- ✅ Error handling and logging
- ✅ Sensitive data redaction in logs

### Testing
- ✅ Unit tests for service and controller
- ✅ Integration tests for API endpoints
- ✅ Comprehensive test coverage

## Usage Examples

### Create Account
```bash
curl -X POST http://localhost:3000/stellar/accounts \
  -H "Content-Type: application/json" \
  -d '{"network": "testnet"}'
```

### Anchor Document
```bash
curl -X POST http://localhost:3000/stellar/anchor \
  -H "Content-Type: application/json" \
  -d '{
    "sourcePublicKey": "G...",
    "sourceSecretKey": "S...",
    "documentHash": "a1b2c3...",
    "network": "testnet"
  }'
```

### Verify Document
```bash
curl -X POST http://localhost:3000/stellar/verify \
  -H "Content-Type: application/json" \
  -d '{
    "documentHash": "a1b2c3...",
    "network": "testnet"
  }'
```
