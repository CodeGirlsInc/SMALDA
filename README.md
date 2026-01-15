SMALDA is an open-source, AI-powered system designed to detect, analyze, and flag risks in land ownership documents in order to prevent land-related disputes.

The project focuses on improving transparency, trust, and verifiability in land administration by combining document intelligence with decentralized verification using the Stellar blockchain.

---

## Problem Statement

Land ownership disputes are often caused by fragmented records, forged or altered documents, missing historical data, and lack of a shared source of truth. In many regions, land records are stored in siloed, centralized systems that are difficult to audit and easy to manipulate.

SMALDA addresses these challenges by analyzing land documents for risk signals and anchoring verifiable proofs on a public blockchain that cannot be altered retroactively.

---

## Solution Overview

SMALDA is composed of three main layers:

1. **Document Intelligence Layer**
   Analyzes land ownership documents to identify inconsistencies, overlapping claims, missing information, and other risk indicators.

2. **Application Layer**
   Provides APIs and a web interface for submitting documents, reviewing analysis results, and managing verification workflows.

3. **Blockchain Verification Layer (Stellar)**
   Stores cryptographic proofs and verification events on the Stellar blockchain, creating an immutable audit trail without exposing sensitive document contents.

---

## Why Stellar

Stellar provides a low-cost, reliable, and publicly verifiable ledger that is well suited for long-term record anchoring. SMALDA uses Stellar not as a data store, but as a neutral verification layer.

By anchoring document hashes, timestamps, and verification references on Stellar, SMALDA enables independent verification of land records across institutions, jurisdictions, and borders.

---

## Benefits to the Stellar Ecosystem

SMALDA expands Stellar’s real-world usage into land administration and legal infrastructure. It demonstrates how Stellar can support public-interest use cases beyond payments by providing a shared, tamper-resistant source of truth.

This strengthens the ecosystem by:

- Increasing adoption in civic and legal domains
- Encouraging new tooling around verification and public records
- Driving on-chain activity tied to real-world assets and records

---

## Benefits to the Project

Integrating Stellar allows SMALDA to:

- Reduce dependence on centralized trust
- Provide verifiable document history
- Enable third-party audits without privileged access
- Maintain low operational and transaction costs

---

## Technology Stack

### Frontend

- Next.js
- TypeScript
- Tailwind CSS

### Backend

- NestJS
- PostgreSQL
- TypeORM

### Blockchain

- Stellar ecosystem (document verification and audit trail)

---

## Architecture Overview

1. User uploads a land ownership document
2. Backend services extract and analyze document data
3. Risk indicators are generated and stored off-chain
4. A cryptographic hash and verification metadata are written to Stellar
5. Verification results can be independently validated using on-chain records

---

## Installation

### Prerequisites

- Node.js (v18 or later)
- PostgreSQL (v14 or later)
- npm or yarn
- Git

---

### Clone the Repository

```bash
git clone https://github.com/your-org/smalda.git
cd smalda
```

---

### Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file:

```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=smalda

STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
```

Run database migrations:

```bash
npm run migration:run
```

Start the backend server:

```bash
npm run start:dev
```

The backend will be available at `http://localhost:3001`.

---

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:3000`.

---

## Usage

1. Create an account or sign in
2. Upload a land ownership document (PDF or image)
3. View extracted data and risk indicators
4. Submit the document for verification
5. Retrieve a Stellar transaction reference for audit and validation

Verification records can be shared with third parties to independently confirm document integrity.

---

## Stellar Integration (Current & Planned)

At the current stage, Stellar integration will be focusing on:

- Anchoring document hashes
- Recording verification timestamps
- Linking verification events to application records

Planned improvements include:

- Ownership transfer event tracking
- Multi-party verification workflows
- Public verification endpoints for external auditors

---

## Development

### Running Tests

```bash
npm run test
```

### Linting

```bash
npm run lint
```

---

## Contributing

Contributions are welcome from developers, researchers, legal professionals, and blockchain engineers.

Please:

1. Fork the repository
2. Create a feature branch
3. Submit a pull request with a clear description
