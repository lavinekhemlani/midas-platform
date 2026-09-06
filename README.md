<p align="left">
  <img src="./public/images/hero/logo_gold_new.svg" alt="Midas Logo" width="60" />
</p>

# Midas - AI-Powered Financial Management Platform

## Overview

Midas is an intelligent financial management platform that combines multi-provider accounting integration with advanced AI capabilities to deliver real-time business insights and automated financial advisory services.

### Key Features

- 🤖 **AI-Powered Analysis**: Multi-agent system with specialized financial advisors
- 📊 **Multi-Provider Integration**: Connect with Zoho Books, QuickBooks, and Xero
- 📈 **Real-Time Dashboards**: Interactive financial health monitoring
- 📑 **Automated Reporting**: Generate and export comprehensive financial reports
- 💬 **Conversational Interface**: Natural language financial queries
- 🧠 **Memory System**: Context-aware responses with persistent learning

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, AWS Cognito, DynamoDB
- **AI/ML**: LangChain, Groq/OpenAI LLMs
- **Charts**: Chart.js, Recharts, React-PDF

## Getting Started

### Prerequisites

- Node.js 24+
- npm
- AWS Account (for Cognito and DynamoDB)
- API keys for chosen LLM provider (Groq/OpenAI)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/zenith-os.git
cd zenith-os
```

2. Install dependencies:

```bash
npm install --legacy-peer-deps
```

3. Set up environment variables:

```bash
cp .env.example .env.local
```

4. Configure your environment variables in `.env.local`

5. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Project Structure

```
src/
├── app/          # Next.js app router pages
├── components/   # Reusable React components
├── lib/          # Core business logic
│   ├── ai/       # AI agents and tools
│   └── providers/ # Accounting provider integrations
├── contexts/     # React context providers
└── styles/       # Global styles
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking

## Documentation

- [Architecture Documentation](./ARCHITECTURE.md) - Detailed system architecture
- [API Documentation](./docs/API.md) - API endpoints and usage
- [Provider Integration](./docs/PROVIDERS.md) - Adding new accounting providers

## Contributing

Please read our [Contributing Guidelines](./CONTRIBUTING.md) before submitting pull requests.

## License

This project is proprietary software. All rights reserved.

<!--
## Support

For support, email support@zenith-os.com or open an issue in this repository. -->

<!-- Node version : v24.4.1 on joel's machine -->

<!-- changed readme for testing -->
<!-- change readme for pull request test -->
<!-- joeldev branch PR test -->
<!-- Anu readme fix-refix-refix-uat -->
<!-- merge yash , fixed again ahahahaha, more fix, refi, quickbooks auth race, package json, qb race, connected state management, dependency, comment cashflow analytics, report fetch fix-->
<!-- I have no idea whats going on here, yadayada............. ritual never stop omg and its keep going-...... and going... no more just usd v and asdoifhaosdhfoiashdf 5 hhellow world retry when rate limited, no ar errorrr rate limittt welcome landing anu cleanup connect help->
<!-- Divya, merging the new updates i hate this so much. >
<!-- Lil, cheeky edit on the 'ole readme yoyoyo -->
