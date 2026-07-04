import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf8');

// First, remove the setWebhook code.
content = content.replace(/if \(botToken && appUrl\) \{[\s\S]*?catch\(err => console\.error\("Failed to set Telegram webhook", err\)\);\n\}/, 
`if (botToken) {
  // Delete webhook to enable polling
  fetch(\`https://api.telegram.org/bot\${botToken}/deleteWebhook\`)
    .then(() => console.log("Webhook deleted, ready for polling"))
    .catch(e => console.error(e));
}`);

// Second, replace the webhook route with a background polling loop!
const webhookRouteStr = `  // Telegram Webhook
  app.post("/api/telegram/webhook", async (req, res) => {
    try {
      const update = req.body;
      const botToken = process.env.TELEGRAM_BOT_TOKEN || "8921472886:AAFcmsM2xVoWlHMYYDrjX58r4DMY6tRMymc";
      const chatIdAllowed = process.env.TELEGRAM_CHAT_ID || "8407449803";`;

const pollingCode = `  // Telegram Background Polling (because Webhooks are blocked by AI Studio auth proxy)
  if (botToken) {
    let offset = 0;
    setInterval(async () => {
      try {
        const response = await fetch(\`https://api.telegram.org/bot\${botToken}/getUpdates?offset=\${offset}&timeout=10\`);
        const data = await response.json();
        
        if (data.ok && data.result.length > 0) {
          for (const update of data.result) {
            offset = update.update_id + 1; // mark as processed
            
            const chatIdAllowed = process.env.TELEGRAM_CHAT_ID || "8407449803";
            
            if (!getApps().length) {
              console.warn("Firebase Admin not initialized, cannot process Telegram actions.");
              continue;
            }

            const db = getFirestore();
`;

// wait, to do this perfectly, I should just completely replace the webhook route with the polling loop.
