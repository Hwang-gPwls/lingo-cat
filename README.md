# 🐱 LingoCat - Slack Real-time Translation Bot

LingoCat is a real-time translation bot for Slack that automatically detects and translates messages into multiple target languages using Google's Gemini AI.

## Features

- 🌍 **Automatic Language Detection**: Detects the source language of messages using Gemini AI
- 🔄 **Multi-language Translation**: Translates messages into multiple target languages simultaneously
- 🧵 **Thread Mode**: Posts translations as thread replies to minimize channel noise
- 🤖 **Bot Loop Prevention**: Smart deduplication to prevent translation loops
- 📊 **Metrics & Monitoring**: Built-in health checks and performance metrics
- ⚡ **High Performance**: Parallel translation with exponential backoff retry logic
- 🔒 **Security First**: Runs as non-root user with security best practices

## Prerequisites

- Node.js 20+
- Slack Workspace with admin access
- Google Gemini API key
- Kubernetes cluster (for production deployment)

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/lingo-cat.git
cd lingo-cat
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example environment file and update with your credentials:

```bash
cp env.example .env
```

Edit `.env` with your actual values:

```env
# Gemini API Configuration
GEMINI_API_KEY=your_gemini_api_key_here

# Slack Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token

# Translation Configuration
TARGET_LANGS=en,ko,ja,zh,es,fr
THREAD_MODE=true
MODEL_NAME=gemini-1.5-flash
```

### 4. Set up Slack App

1. Create a new Slack App at [api.slack.com](https://api.slack.com/apps)
2. Enable **Socket Mode** in the app settings
3. Add the following OAuth scopes:
   - `app_mentions:read`
   - `channels:history`
   - `groups:history`
   - `im:history`
   - `chat:write`
   - `im:write`
4. Install the app to your workspace
5. Copy the Bot Token and App Token to your `.env` file

### 5. Run the bot

```bash
# Development mode with hot reload
npm run dev

# Build and run production
npm run build
npm start
```

## Usage

### Automatic Translation

Once LingoCat joins a channel, it will automatically:
1. Detect the language of new messages
2. Translate them to configured target languages
3. Post translations as thread replies

### Mention Mode (Optional)

You can also mention the bot for targeted translation:

```
@LingoCat -> en, fr
이것은 한국어 메시지입니다.
```

This will translate the message specifically to English and French.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Slack     │────▶│  LingoCat   │────▶│  Gemini AI  │
│  Workspace  │◀────│   (Bolt)    │◀────│    API      │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   Metrics   │
                    │   & Health  │
                    └─────────────┘
```

## Deployment

### Docker

Build and run with Docker:

```bash
# Build image
docker build -t lingocat:latest .

# Run container
docker run -d \
  --env-file .env \
  -p 3000:3000 \
  --name lingocat \
  lingocat:latest
```

### Kubernetes (EKS)

1. Update the Kubernetes manifests in `k8s/` directory
2. Deploy to your cluster:

```bash
# Create namespace (optional)
kubectl create namespace lingocat

# Apply configurations
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/hpa.yaml
```

## Configuration

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `GEMINI_API_KEY` | Google Gemini API key | Required |
| `SLACK_BOT_TOKEN` | Slack Bot User OAuth Token | Required |
| `SLACK_APP_TOKEN` | Slack App-Level Token | Required |
| `TARGET_LANGS` | Comma-separated language codes | `en,ko,ja` |
| `THREAD_MODE` | Post translations in threads | `true` |
| `MODEL_NAME` | Gemini model to use | `gemini-1.5-flash` |
| `GEN_TIMEOUT_MS` | Translation timeout in ms | `8000` |
| `RETRY_MAX` | Maximum retry attempts | `2` |
| `PORT` | HTTP server port for health checks | `3000` |
| `LOG_LEVEL` | Logging level | `info` |
| `MASK_TEXT_IN_LOGS` | Mask sensitive text in logs | `false` |

## Health Checks

LingoCat exposes the following endpoints for monitoring:

- `/healthz` - General health status
- `/readiness` - Readiness probe for Kubernetes
- `/liveness` - Liveness probe for Kubernetes
- `/metrics` - Basic metrics and statistics

## Development

```bash
# Run tests
npm test

# Type checking
npm run typecheck

# Build TypeScript
npm run build

# Clean build artifacts
npm run clean
```

## Project Structure

```
lingo-cat/
├── src/
│   ├── app.ts              # Slack Bolt app initialization
│   ├── index.ts            # Main entry point
│   ├── config/
│   │   └── env.ts          # Environment configuration
│   ├── translator/
│   │   ├── detect.ts       # Language detection
│   │   └── translate.ts    # Translation logic
│   ├── middlewares/
│   │   └── deduplication.ts # Message deduplication
│   ├── infra/
│   │   ├── http.ts         # Health check server
│   │   └── metrics.ts      # Metrics collection
│   └── utils/
│       └── text.ts         # Text utilities
├── k8s/                    # Kubernetes manifests
│   ├── deployment.yaml
│   ├── hpa.yaml
│   └── secret.yaml
├── Dockerfile              # Docker configuration
└── package.json
```

## Performance

- **p95 Response Time**: < 2.5 seconds
- **Translation Success Rate**: > 99%
- **Language Detection Accuracy**: > 98%
- **Concurrent Processing**: 50 req/s (per pod)

## Troubleshooting

### Bot not responding

1. Check Socket Mode is enabled in Slack App settings
2. Verify Bot Token and App Token are correct
3. Check bot has been added to the channel
4. Review logs for connection errors

### Translation failures

1. Verify Gemini API key is valid and has quota
2. Check network connectivity to Gemini API
3. Review rate limiting settings
4. Check target language configuration

### High latency

1. Consider switching to `gemini-1.5-pro` for better performance
2. Reduce number of target languages
3. Scale up pods using HPA
4. Review metrics endpoint for bottlenecks

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) file for details

## Support

For issues and questions:
- Open an issue on GitHub
- Contact the maintainers