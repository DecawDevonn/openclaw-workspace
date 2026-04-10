# Google Account Setup Guide

## For Daily Briefings (Calendar + Gmail)

### Option 1: Maton API Gateway (Recommended)

**Prerequisites:**
- Maton account: https://maton.ai
- API key from: https://maton.ai/settings

**Setup:**

1. **Get API Key**
   ```bash
   # Sign up at https://maton.ai
   # Go to Settings → API Key → Copy
   export MATON_API_KEY="your_key_here"
   ```

2. **Create Google Connections**
   ```bash
   # Connect Google Calendar
   python <<'EOF'
   import urllib.request, json, os
   data = json.dumps({'app': 'google-calendar'}).encode()
   req = urllib.request.Request('https://ctrl.maton.ai/connections', data=data, method='POST')
   req.add_header('Authorization', f'Bearer {os.environ["MATON_API_KEY"]}')
   req.add_header('Content-Type', 'application/json')
   resp = json.load(urllib.request.urlopen(req))
   print(f"Open this URL to authorize: {resp['url']}")
   EOF
   ```

3. **Connect Gmail**
   ```bash
   python <<'EOF'
   import urllib.request, json, os
   data = json.dumps({'app': 'google-mail'}).encode()
   req = urllib.request.Request('https://ctrl.maton.ai/connections', data=data, method='POST')
   req.add_header('Authorization', f'Bearer {os.environ["MATON_API_KEY"]}')
   req.add_header('Content-Type', 'application/json')
   resp = json.load(urllib.request.urlopen(req))
   print(f"Open this URL to authorize: {resp['url']}")
   EOF
   ```

4. **Test Connections**
   ```bash
   # List your connections
   python <<'EOF'
   import urllib.request, json, os
   req = urllib.request.Request('https://ctrl.maton.ai/connections')
   req.add_header('Authorization', f'Bearer {os.environ["MATON_API_KEY"]}')
   print(json.dumps(json.load(urllib.request.urlopen(req)), indent=2))
   EOF
   ```

5. **Use in Daily Briefings**
   Once connected, the daily-brief skill can fetch:
   - Calendar events
   - Unread emails
   - Tasks

---

### Option 2: Native OpenClaw Integration (If Available)

Some OpenClaw installations have native Google integration:

```bash
# Check if gog skill is available
openclaw skills list | grep -i google

# If available:
GOG_KEYRING_PASSWORD=myclaw123 gog auth login
```

---

### Option 3: Manual OAuth (Advanced)

1. Go to https://console.cloud.google.com
2. Create a new project
3. Enable APIs:
   - Google Calendar API
   - Gmail API
4. Create OAuth 2.0 credentials
5. Download client_secret.json
6. Use with your preferred client library

---

## Quick Test After Setup

```bash
# Test calendar access
python <<'EOF'
import urllib.request, json, os
req = urllib.request.Request('https://gateway.maton.ai/google-calendar/calendar/v3/calendars/primary/events?maxResults=10')
req.add_header('Authorization', f'Bearer {os.environ["MATON_API_KEY"]}')
resp = json.load(urllib.request.urlopen(req))
for event in resp.get('items', []):
    print(f"- {event.get('summary', 'No title')} at {event.get('start', {}).get('dateTime', 'All day')}")
EOF
```

---

## Troubleshooting

**"Invalid API key"**
- Verify MATON_API_KEY is set: `echo $MATON_API_KEY`
- Get fresh key from https://maton.ai/settings

**"No connection found"**
- Complete OAuth flow by opening the provided URL
- Check connection status in Maton dashboard

**"Rate limited"**
- Google API has quotas
- Wait a few minutes and retry

---

## What You Get

Once connected:
- ✅ Calendar events in daily briefings
- ✅ Email highlights and summaries
- ✅ Task integration
- ✅ Automatic timezone handling
