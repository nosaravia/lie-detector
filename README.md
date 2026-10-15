# Lie Detector

A noir party game for 2–8 players. Write two truths and a lie, defend your case, and catch your friends bluffing. Includes speed bonuses, Double Down, the Informant, original character portraits, solo Case Files, and classroom topic packs.

## Play

Create a room, share its invitation link or code, and have each player join on their own phone or laptop. No accounts or installation. Rules and a practice case are included on the home screen.

## Publish with Cloudflare Workers Builds

1. Create a D1 database named `lie-detector-db`.
2. Connect this GitHub repository to a Worker named `lie-detector`.
3. Build command: `npm run build`.
4. Deploy command: `npm run deploy`.
5. Build variable: `LIE_DETECTOR_DATABASE_ID`, set to the D1 database UUID.

The deploy script applies the room-storage schema and binds D1 as DB. Cloudflare manages the build credentials. Do not commit tokens or passwords. Keep public workers.dev access enabled so visitors can play without signing in.

Room state is stored in D1 with revision checks so simultaneous votes and joins cannot overwrite one another. Rooms expire after 24 hours without a stored change. Your local browser retains your player session and writing drafts. Cloudflare-hosted multiplayer still needs a live end-to-end check before competition submission.
