# Campaigns — community-funded message amplification

Mobile prototype (React Native + Expo) with a Node/Express API.

```
apps/mobile   Expo app (SDK 58, expo-router, TypeScript)
apps/server   Express + Prisma (SQLite) API
shared/       Domain model used by both: lifecycle, reach/fee estimates, validation
```

## Run it on your phone with Expo Go

You need: Node 20+, the latest **Expo Go** app (it must support SDK 58), and your phone on the **same Wi-Fi** as your computer.

**1. Start the API** (terminal 1)

```bash
cd apps/server && npm install && npm run setup && npm run dev
```

`setup` creates the SQLite database and loads the sample campaigns. Run `npm run seed` any time to reset the demo data. The API listens on port 4000.

**2. Start the app** (terminal 2)

```bash
cd apps/mobile && npm install && npx expo start
```

Scan the QR code with your phone camera (iPhone) or the Expo Go app (Android).

The app finds the API automatically at `http://<your computer's IP>:4000`. If campaigns don't load:

- macOS may ask whether to allow incoming connections for `node`. Choose **Allow**.
- Check that `http://<your-ip>:4000/health` opens in your phone's browser.
- Or set the address yourself: `EXPO_PUBLIC_API_URL=http://192.168.x.x:4000 npx expo start`

## Checks

```bash
cd apps/server && npm run smoke      # end-to-end API test (server must be running)
cd apps/mobile && npx tsc --noEmit && npx expo lint
```

## Demo accounts

Browsing needs no account. The app creates a guest session automatically for backing and drafts.

- Demo creator: `alex@demo.campaigns`
- Reviewer: `review@demo.campaigns`

## AI drafting

Set `ANTHROPIC_API_KEY` in `apps/server/.env` to use Claude for drafting. Without a key, drafting runs in a clearly labelled demo mode.
