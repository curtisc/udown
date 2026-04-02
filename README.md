# uDown

> Who's down? 🙋

An open source platform for small communities to coordinate in-person events and hangouts. Post an event, see who's down, show up.

Built for friend groups, alumni networks, church communities, hobby clubs — any group of people who want to spend more time together IRL.

## Features

- **Anyone can post** — no gatekeepers, any group member can create an event
- **One-tap RSVP** — just tap "I'm Down"
- **Ad-hoc subgroups** — create groups around interests (hiking, board games, parents) and let communities form organically within your org
- **Smart notifications** — email and SMS alerts for new events, updates, and reminders with fine-grained per-group control
- **Location autocomplete** — powered by Google Places so events always have a tappable address
- **Access control** — email whitelist with domain wildcards, plus a friendly access request flow with one-click admin approval
- **Configurable auth** — Google, GitHub, Apple, or Email Magic Link — enable whichever providers your community needs
- **Admin dashboard** — manage members, whitelist, branding (logo, org name), email settings, and monitor group activity
- **Inactivity nudges** — admins get notified when groups go quiet so nothing becomes a zombie
- **Mobile-first** — designed for the phone in your pocket
- **Multi-group** — users belong to a default org group plus any number of subgroups, each with their own events and notification settings

## Tech Stack

- [Next.js](https://nextjs.org/) (App Router + TypeScript)
- [Prisma](https://www.prisma.io/) + [Neon](https://neon.tech/) (serverless Postgres)
- [Auth.js](https://authjs.dev/) (configurable OAuth + Magic Link)
- [Tailwind CSS](https://tailwindcss.com/)
- [Resend](https://resend.com/) (transactional email)
- [Twilio](https://www.twilio.com/) (SMS notifications)
- [Google Places API](https://developers.google.com/maps/documentation/places/web-service) (location autocomplete)
- [Vercel Blob](https://vercel.com/docs/vercel-blob) (file storage)
- Deployed on [Vercel](https://vercel.com/)

## Getting Started

```bash
# Clone the repo
git clone https://github.com/curtisc/udown.git
cd udown

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Fill in your database URL, auth provider credentials, and API keys (see below)

# Run database migrations
npx prisma migrate dev

# Start the dev server
npm run dev
```

## Environment Variables

At minimum, you need a database, an auth secret, and at least one auth provider. Everything else is optional and enables additional features.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon Postgres connection string |
| `AUTH_SECRET` | Yes | Auth.js secret (`openssl rand -base64 32`) |
| `ORG_NAME` | Yes | Your organization name (e.g. "Berkeley/UCSF CPH Program") |
| `AUTH_GOOGLE_ID` | * | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | * | Google OAuth client secret |
| `AUTH_GITHUB_ID` | * | GitHub OAuth client ID |
| `AUTH_GITHUB_SECRET` | * | GitHub OAuth client secret |
| `AUTH_APPLE_ID` | * | Apple OAuth client ID |
| `AUTH_APPLE_SECRET` | * | Apple OAuth client secret |
| `AUTH_EMAIL_ENABLED` | * | Set to `true` for Email Magic Link auth |
| `ORG_DOMAIN` | No | Seeds whitelist with a domain (e.g. `berkeley.edu`) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | No | Enables location autocomplete for events |
| `RESEND_API_KEY` | No | Enables email notifications and magic link auth |
| `RESEND_FROM_EMAIL` | No | Sender address (e.g. `events@yourdomain.com`) |
| `TWILIO_ACCOUNT_SID` | No | Enables SMS notifications |
| `TWILIO_AUTH_TOKEN` | No | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | No | Twilio sender phone number |

\* At least one auth provider must be configured.

## Deploying Your Own Instance

uDown is designed to be easily deployed as a standalone instance for your community:

1. Fork this repo
2. Create a [Neon](https://neon.tech/) database (free tier)
3. Set up a [Vercel](https://vercel.com/) project pointing to your fork
4. Configure environment variables in Vercel
5. Add DNS records for your domain (and Resend DKIM/SPF if using email notifications)
6. Deploy — the default org group is auto-created on first run

## Contributing

Contributions welcome! Please open an issue first to discuss what you'd like to change.

## License

MIT
