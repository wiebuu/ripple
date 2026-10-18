# Deploying Ripple: API on a VPS, APK for testers

The APK talks to the API over plain HTTP at `http://<VPS_IP>:4000` (no domain needed).
Android allows this because `usesCleartextTraffic` is turned on in `apps/mobile/app.json`.

Replace `<VPS_IP>` everywhere below with your server's public IP.

## 1. Server prerequisites (Ubuntu)

```bash
sudo apt update && sudo apt install -y git docker.io
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

## 2. MongoDB as a replica set

Prisma needs a replica set to write data (a plain MongoDB fails with
"Transactions are not supported by this deployment").

```bash
sudo docker run -d --name ripple-mongo --restart unless-stopped \
  -p 127.0.0.1:27017:27017 -v ripple-mongo:/data/db \
  mongo:7 --replSet rs0 --bind_ip_all
sleep 5
sudo docker exec ripple-mongo mongosh --quiet --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})'
```

The port is bound to `127.0.0.1`, so the database is not reachable from the internet.

## 3. API

```bash
git clone https://github.com/wiebuu/ripple.git
cd ripple/apps/server
npm ci
nano .env
```

`.env` (copy the Razorpay test keys, Firebase and Gemini values from your Mac's `apps/server/.env`):

```
DATABASE_URL="mongodb://127.0.0.1:27017/ripple?replicaSet=rs0&directConnection=true"
PORT=4000
PUBLIC_URL=http://<VPS_IP>:4000
JWT_SECRET=<a long random string: run `openssl rand -hex 32`>
GEMINI_API_KEY=
AI_MODEL=
FIREBASE_PROJECT_ID=
FIREBASE_WEB_API_KEY=
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
```

Create the tables and demo data. Run `setup` only once: the seed wipes the database.

```bash
npm run setup
pm2 start npm --name ripple-api -- start
pm2 save
pm2 startup   # prints one command; run it so the API restarts after a reboot
```

Open the port (allow SSH first so you don't lock yourself out). If your provider has its own
firewall or security group (AWS, Oracle, GCP, ...), open TCP 4000 there too.

```bash
sudo ufw allow OpenSSH
sudo ufw allow 4000/tcp
sudo ufw enable
```

Check from your phone's browser on mobile data: `http://<VPS_IP>:4000/campaigns` should show JSON.

Updating later: `git pull && npm ci && pm2 restart ripple-api`.

## 4. Build the APK

1. In `apps/mobile/eas.json`, under `build.preview.env`, set
   `"EXPO_PUBLIC_API_URL": "http://<VPS_IP>:4000"`.
2. Build in the cloud (free Expo account; log in when asked):

```bash
cd apps/mobile
npx eas-cli@latest build -p android --profile preview
```

When it finishes, EAS prints a link to download the `.apk`.

## 4b. Push notifications (one-time setup)

The server already sends every notification (approved, milestones, ads live …) to phones through
Expo's push service. Android delivery goes through Firebase Cloud Messaging, which needs your
Firebase project linked once:

1. Link the app to an EAS project (adds `extra.eas.projectId` to `app.json`):
   ```bash
   cd apps/mobile
   npx eas-cli@latest init
   ```
2. Firebase console → Project settings → General → **Add app → Android**, package name
   `com.ripple.app`. Download `google-services.json` into `apps/mobile/`, then add to `app.json`
   under `expo.android`: `"googleServicesFile": "./google-services.json"`.
3. Firebase console → Project settings → **Service accounts → Generate new private key**. Upload
   that JSON to Expo:
   ```bash
   npx eas-cli@latest credentials
   ```
   Android → production/preview → Google Service Account → **FCM V1** → upload the key.
4. Rebuild the APK. On first launch the app asks for notification permission and registers the
   phone. Push doesn't work in Expo Go on Android; it does in the APK.

## Live updates

Campaign pages update live over a WebSocket at `ws://<VPS_IP>:4000/live` (same port, nothing to open).
Sample campaigns get an occasional simulated backer while someone is watching, so it can be seen
with one phone. Set `LIVE_DEMO=0` in `.env` to turn that off.

## 5. Before sending it to anyone

- Install the APK on your own phone, switch to **mobile data**, and walk through:
  guest sign-in, Home, a campaign page, backing with a Razorpay test card, and creating a campaign
  with a photo upload.
- Android shows "Install unknown apps" and may show a Play Protect warning for APKs from outside the
  Play Store. This is normal; mention it to testers.
- Google sign-in shows "isn't configured" unless you add a Google web client ID to `eas.json` and
  register the EAS keystore's SHA-1 in Google Cloud. Guest sign-in works without it.
- Payments are Razorpay **test mode**: no real money moves. The app's test guide lists the test cards.
- Keep the VPS running while testers use the app.
