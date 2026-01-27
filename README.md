# 🎫 Loket War Bot

High-speed ticket buying bot for **Loket.com** using Playwright with stealth capabilities.

> ⚠️ **Disclaimer**: This bot is for educational purposes only. Use at your own risk. Automated ticket purchasing may violate Loket.com's Terms of Service.

## ✨ Features

- **Stealth Mode**: Uses `playwright-extra` with stealth plugins to evade bot detection
- **High-Speed Polling**: 100ms interval scanning for ticket availability
- **Waiting Room Handler**: Detects LOKET Q (Antrean) and waits patiently without refreshing
- **Smart Category Selection**: Matches ticket categories by keyword with automatic fallback
- **Auto Form Fill**: Instantly fills NIK, Name, Email, and Phone from config
- **Payment Navigation**: Automatically proceeds to payment method selection

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) v16 or higher
- A Loket.com account

## 🚀 Installation

1. **Clone or download this folder**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install Chromium browser for Playwright**
   ```bash
   npm run install-browser
   ```

4. **Create your configuration**
   ```bash
   copy config.example.json config.json
   ```

5. **Edit `config.json`** with your details:
   ```json
   {
     "targetUrl": "https://loket.com/event/your-event-link",
     "categoryKeywords": ["CAT 1", "VIP", "GOLD"],
     "ticketAmount": 1,
     "personalData": {
       "name": "Your Full Name",
       "nik": "1234567890123456",
       "email": "your@email.com",
       "phone": "08123456789"
     },
     "settings": {
       "pollIntervalMs": 100,
       "headless": false,
       "timeout": 30000
     }
   }
   ```

## 📖 Usage

### Step 1: Login & Save Session

Run the authentication script to save your login session:

```bash
npm run auth
```

A browser window will open. **Login manually** to your Loket.com account. The bot will detect when you're logged in and save the session to `session.json`.

### Step 2: Run the Bot

When the ticket sale starts, run the bot:

```bash
npm start
```

The bot will:
1. Load your saved session (no need to login again)
2. Navigate to the target event
3. Poll for the "Beli Tiket" button every 100ms
4. Handle waiting room if present
5. Select your preferred ticket category
6. Fill in your personal data
7. Navigate to payment page
8. **Stop at payment method selection** (you complete payment manually)

## ⚙️ Configuration Options

| Field | Description |
|-------|-------------|
| `targetUrl` | Full URL of the Loket.com event page |
| `categoryKeywords` | Array of category names to match (in order of preference) |
| `ticketAmount` | Number of tickets to purchase |
| `personalData.name` | Your full name (as on ID) |
| `personalData.nik` | Your NIK (16-digit ID number) |
| `personalData.email` | Your email address |
| `personalData.phone` | Your phone number |
| `settings.pollIntervalMs` | How often to check for button (default: 100ms) |
| `settings.headless` | Run browser hidden (default: false) |
| `settings.timeout` | Page load timeout in ms (default: 30000) |

## 🎯 Category Keywords Tips

The bot searches for ticket categories containing your keywords. Examples:
- `["FESTIVAL", "GA"]` - Will try FESTIVAL first, then GA (General Admission)
- `["CAT 1", "CAT 2", "CAT 3"]` - Will try categories in order
- `["VIP", "PLATINUM", "GOLD"]` - Premium categories first

If all preferred categories are sold out, the bot will attempt to select any available category.

## 🚦 Waiting Room (LOKET Q)

When Loket activates their waiting room queue:
- The bot detects URLs containing `waiting-room`, `queue`, or `antrean`
- It will **NOT** refresh the page to avoid losing your spot
- It displays queue status and waits for automatic redirect
- Once out of the queue, it resumes the ticket buying flow

## 🔧 Troubleshooting

### "session.json not found"
Run `npm run auth` first to login and save your session.

### "config.json not found"
Copy `config.example.json` to `config.json` and fill in your details.

### Bot can't find the buy button
- The event might not have started yet
- The button might have different text (check selectors.js)
- Try increasing `pollIntervalMs` if your connection is slow

### Form fields not filling
Loket may have changed their form structure. Update selectors in `utils/selectors.js`.

### Session expired
Run `npm run auth` again to create a fresh session.

## 📁 Project Structure

```
BotWarTiket/
├── package.json          # Dependencies & scripts
├── config.json           # Your configuration (gitignored)
├── config.example.json   # Configuration template
├── session.json          # Saved login session (gitignored)
├── auth.js               # Login & session saver
├── bot.js                # Main war engine
├── utils/
│   ├── logger.js         # Console output formatting
│   └── selectors.js      # DOM selectors for Loket.com
├── .gitignore
└── README.md
```

## ⚡ Performance Tips

1. **Run bot before sale starts** - Be ready when tickets go live
2. **Use wired connection** - More stable than WiFi
3. **Close other apps** - Free up system resources
4. **Have backup payment ready** - Some methods are faster than others
5. **Set multiple category keywords** - Increases chances of getting a ticket

## 📝 License

MIT License - Use at your own risk.

---

**Good luck with your ticket war! 🎉**
