# Ripple: community-funded message amplification

Mobile prototype (React Native + Expo SDK 57) with a Node/Express API on MongoDB (Prisma). Backers pay to show a campaign's message to people outside the creator's network. It is not a donation platform.

```
apps/mobile   Expo app (expo-router, TypeScript)
apps/server   Express + Prisma API (MongoDB)
shared/       Domain model used by both: lifecycle, reach/fee estimates, validation
```

## Run it on your phone with Expo Go

You need Node 22 or 24, the **Expo Go** app, and your phone on the **same Wi-Fi** as your computer.

**1. Start MongoDB** (terminal 1). This is a local single-node replica set in `apps/server/.mongo-data`; Prisma needs a replica set. Skip this step if `DATABASE_URL` points at Atlas.

```bash
cd apps/server && npm run db:local
```

The first time only, in another terminal:

```bash
cd apps/server && npm run db:init
```

**2. Start the API** (terminal 2)

```bash
cd apps/server && npm install && npm run setup && npm run dev
```

`setup` creates the indexes and loads sample campaigns. Run `npm run seed` any time to reset the demo data.

**3. Start the app** (terminal 3)

```bash
cd apps/mobile && npm install && npx expo start -c
```

Scan the QR code with the iPhone camera, or with Expo Go on Android. The app finds the API at `http://<your computer's IP>:4000`. If campaigns don't load:

- On macOS, allow incoming connections for `node` when asked.
- Check that `http://<your-ip>:4000/health` opens in your phone's browser.
- Or set the address yourself: `EXPO_PUBLIC_API_URL=http://192.168.x.x:4000 npx expo start -c`

**Expo Go limitations:** Expo Go shows its own icon and splash screen. The Ripple icon and native splash appear in the APK build. Voice creation uses spoken prompts plus your keyboard's dictation microphone, which works everywhere, including Expo Go.

## Demo walkthrough

| Who | How |
| --- | --- |
| Guest backer | Just open the app. Browsing and backing need no account. |
| Creator | Profile → Sign in → **Continue as Alex**: campaigns in every state |
| Reviewer | Profile → Sign in → **Continue as Sam**: Profile → Review queue |

**Payments.** With `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` set to **test** keys (`rzp_test_…`), backers can pay through Razorpay Checkout in test mode (INR at a demo rate of $1 = ₹84; the server verifies every payment signature). Live keys (`rzp_live_…`) are refused at startup, so no real money can move. Without test keys, payments are unavailable.

**Testing a Razorpay payment (test mode, no real money):**
1. Back any campaign and continue to the payment screen.
2. Under "How to test", choose **Payment succeeds** or **Payment fails**. The matching test UPI ID appears with a Copy button.
3. Tap **Pay with Razorpay (test mode)** and enter any 10-digit mobile number.
4. Choose UPI and paste `success@razorpay` (or `failure@razorpay`), or choose Netbanking, pick any bank and tap Success or Failure.
5. A successful payment lands on the confirmation screen with a receipt; a failed one shows "Payment unsuccessful" and takes no money.


## Checks

```bash
cd apps/server && npm run smoke      # end-to-end API test; start the API with ALLOW_SIMULATED_PAYMENTS=1
cd apps/mobile && npx tsc --noEmit && npx expo lint
```

## Android APK (EAS)

1. Deploy the API somewhere public, for example Render (`npm run setup && npm start`), and set `JWT_SECRET`.
2. Put that URL in `apps/mobile/eas.json` → `build.preview.env.EXPO_PUBLIC_API_URL`.
3. Build the APK:

```bash
cd apps/mobile && npx eas-cli@latest build -p android --profile preview
```

## Configuration (`apps/server/.env`, never committed)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | MongoDB connection string. Local replica set by default; use an Atlas `mongodb+srv://…/ripple` URI for the deployed API. |
| `JWT_SECRET` | Signs Ripple session tokens. |
| `GEMINI_API_KEY`, `AI_MODEL` | AI drafting with Gemini (default model `gemini-flash-latest`). Without a valid key, drafting uses a clearly labelled demo mode. AI never sets the funding goal. |
| `FIREBASE_PROJECT_ID`, `FIREBASE_WEB_API_KEY` | Google sign-in through Firebase Authentication. |

## Google sign-in (Firebase)

Google sign-in uses a native module, so it works in the APK and development builds, **not in Expo Go**. In Expo Go the button explains this. Setup:

1. Firebase console → Authentication → Sign-in method → enable **Google**.
2. Firebase console → Project settings → copy the **Web API key** into `FIREBASE_WEB_API_KEY`.
3. Google Cloud console → Credentials: copy the **Web client ID** (auto-created by Firebase) into `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `apps/mobile/eas.json`. Create an **Android** OAuth client for package `com.ripple.app` with your build's SHA-1 (`npx eas-cli credentials`).
4. For iOS, also set `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, and add the `@react-native-google-signin/google-signin` plugin to `app.json` with `iosUrlScheme`.
