# Channel Setup Guide

## Available Channels

OpenClaw supports multiple messaging channels for capture and notifications.

---

## Option 1: Telegram (Recommended - Easiest)

### Step 1: Create Bot
1. Open Telegram and search for **@BotFather**
2. Send `/newbot`
3. Follow prompts:
   - Name: `MyClaw Assistant`
   - Username: `yourname_claw_bot` (must end in _bot)
4. **Copy the API token** (looks like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### Step 2: Add to OpenClaw
```bash
openclaw channels add --channel telegram --token YOUR_BOT_TOKEN
```

### Step 3: Test
1. Find your bot in Telegram (search for the username)
2. Send `/start`
3. Send a test message to your bot
4. It should appear in your OpenClaw workspace

---

## Option 2: WhatsApp (Most Popular)

### Step 1: Prerequisites
- WhatsApp on your phone
- Phone with camera (for QR scan)

### Step 2: Add to OpenClaw
```bash
openclaw channels login --channel whatsapp
```

### Step 3: Authenticate
1. A QR code will be displayed in terminal
2. Open WhatsApp on your phone
3. Go to: Settings → Linked Devices → Link a Device
4. Scan the QR code
5. Wait for "Connected" confirmation

### Step 4: Test
Send a message to your own WhatsApp number (saved contact)

---

## Option 3: Discord

### Step 1: Create Bot
1. Go to: https://discord.com/developers/applications
2. Click "New Application" → Name it "MyClaw"
3. Go to "Bot" section
4. Click "Add Bot"
5. **Copy the token** (under "Token")
6. Enable "Message Content Intent"

### Step 2: Add Bot to Server
1. Go to "OAuth2" → "URL Generator"
2. Select scopes: `bot`
3. Select permissions: `Send Messages`, `Read Message History`
4. Copy the generated URL
5. Open URL in browser and add to your server

### Step 3: Add to OpenClaw
```bash
openclaw channels add --channel discord --token YOUR_BOT_TOKEN
```

---

## Option 4: Slack

### Step 1: Create App
1. Go to: https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Name: "MyClaw" → Select your workspace

### Step 2: Add Permissions
1. Go to "OAuth & Permissions"
2. Add Bot Token Scopes:
   - `chat:write`
   - `im:read`
   - `im:write`
   - `users:read`
3. Install to Workspace
4. **Copy "Bot User OAuth Token"**

### Step 3: Add to OpenClaw
```bash
openclaw channels add --channel slack --token xoxb-YOUR-TOKEN
```

---

## Verification

After setup, verify your channel:

```bash
# List configured channels
openclaw channels list

# Check status
openclaw channels status --probe

# View recent logs
openclaw channels logs
```

---

## Usage After Setup

Once connected, you can:

### Quick Capture
Send voice/text to your bot → automatically captured and classified

### Daily Briefings
Receive morning summaries on your preferred channel

### Notifications
Get alerts for:
- GitHub PRs
- Task reminders
- System events

---

## Troubleshooting

**"Channel not responding"**
- Check token is correct
- Verify bot has permissions
- Check gateway logs: `openclaw logs`

**"Messages not appearing"**
- Ensure you've started the bot (/start for Telegram)
- Check channel is enabled: `openclaw channels list`

**"QR code expired" (WhatsApp)**
- Run `openclaw channels login --channel whatsapp` again
- Generate fresh QR code

---

## Recommended Setup Order

1. **Telegram** (easiest, instant)
2. **WhatsApp** (if you prefer it)
3. **Discord/Slack** (for team use)

Start with one, add others later.
