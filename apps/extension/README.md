# MindSide Meeting MVP

MindSide is a Chrome Manifest V3 side-panel extension built to validate one core idea: can an AI copilot listen to a browser meeting tab and turn it into a useful live transcript and summary?

This first MVP focuses only on meetings. Document mode and screen mode are planned later.

## What It Does

- Opens a native Chrome Side Panel from the toolbar icon.
- Detects Google Meet, Microsoft Teams web, and Zoom web tabs.
- Captures audio from the active meeting tab after the user clicks the extension icon on that tab and then clicks Start.
- Records short `audio/webm` chunks in an offscreen document.
- Sends chunks to Gemini for Portuguese transcription.
- Shows a live transcript feed.
- Generates a markdown meeting summary when recording stops.

## Setup

```bash
cd apps/extension
npm install
npm run build
```

Then load the built extension:

1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Click "Load unpacked".
4. Select `apps/extension/dist`.

## API Key

Open MindSide settings in the side panel and paste a Google Gemini API key. The key is encrypted before being stored in `chrome.storage.local`.

Default model:

```text
gemini-2.5-flash
```

## Testing

1. Open a normal webpage and click the extension icon. The panel should say meeting capture is unavailable.
2. Open a Google Meet tab.
3. Click the MindSide extension icon in the Chrome toolbar while the meeting tab is active. This matters because Chrome only allows `tabCapture` after the extension is invoked for that tab.
4. Click Start capture.
5. Speak or play meeting audio.
6. Wait for transcript chunks.
7. Click Stop and confirm a summary is generated.

Chrome pages such as `chrome://extensions`, `chrome://newtab`, and `chrome-extension://...` cannot be captured by Chrome. Always test capture from an `https://meet.google.com/...`, `https://teams.microsoft.com/...`, or `https://*.zoom.us/wc/...` tab.

## Notes

- Speaker identification is intentionally out of scope for this MVP.
- Live action-item extraction is intentionally out of scope for this MVP.
- If Gemini chunk transcription latency or accuracy is not good enough, the transcription layer should move to a dedicated speech-to-text provider.
