# Neptune SDK Browser

<div align="center">

![Neptune Logo](Latest/resources/logo.png)

**A fast web browser for Fortnite SDK dumps and offsets**

[Live Demo](http://fnsdk.getneptune.tech) • [Features](#features) • [Installation](#installation)

</div>

---

## What is this?

I got tired of having to dig through giant heaps of dumped SDK structs and classes trying to find one singular offset that I needed. And on top of that, dumpspace or other providers are almost never updated on time. So, I decided to make this SDK browser. I plan on adding features to this as I go but for now enjoy the features it has. And, if your a smart one, please, open a pull request and help me improve this.

---

## Features

### What you can do

**Browse the SDK comfortably**
- Thousands of Fortnite UE classes with their full inheritance chains
- Click on any type to jump straight to that class
- See all members with their offsets and sizes at a glance
- Two different views: table mode for scanning, structure mode for deeper dives

**Find stuff fast**
- Search bar with fuzzy matching (misspell stuff and it still works)
- Filter members within a class in real-time
- Both sidebar search and global search options
- Results are sorted by relevance so what you need is usually at the top

**Offsets & Globals**
- All the important offsets in one place (UWorld, GNames, PlayerController, etc.)
- Weapon, vehicle, player, and camera offsets
- Base addresses and member offsets organized by class
- Just copy and paste what you need

**Nice touches**
- Drag the sidebar to resize it however you like
- Dark theme so you don't burn your eyes at 3am
- URLs update as you browse so you can share specific classes
- Works on phones and tablets surprisingly well incase you are in a rush
- Caches everything locally so subsequent loads are instant

### Under the hood

If you're curious about the technical stuff:
- Virtual scrolling (only renders what's visible, so 100k items = no problem)
- Loads in batches of 1000 to keep the UI responsive
- 24-hour localStorage cache
- Pure vanilla JS - no React, no Vue, no nothing
- Responsive CSS with flexbox/grid

---

## Installation

### Just use the live version

Seriously, just go to **[fnsdk.getneptune.tech](http://fnsdk.getneptune.tech)**. It's already hosted and ready to go.

### Or host it yourself

```bash
git clone https://github.com/paysonism/Neptune-SDK-Browser.git
cd Neptune-SDK-Browser

# Pick your favorite server (literally any HTTP server works)
python -m http.server 8000
# or
npx http-server
# or
php -S localhost:8000

# Open http://localhost:8000
```

No build steps, no npm hell, no config files. It's just HTML/CSS/JS.

---

## Project Structure

```
Neptune-SDK-Browser/
│
├── index.html                    # Landing page
│
├── Latest/                       # The actual browser
│   ├── index.html               # Main interface
│   ├── loader.js                # All the logic
│   ├── styles.css               # Dark theme styles
│   │
│   ├── Data/                    # SDK data
│   │   ├── sdk_data.json       # Full SDK dump (huge)
│   │   └── globals.json        # Offsets and base addresses
│   │
│   └── resources/               # Logo and favicon
│
└── SDK Data Converter/          # Python scripts to generate the data
    ├── convert_sdk.py          # Converts Dumper-7 .h files to JSON
    ├── create_globals.py       # Makes globals.json
    └── analysis.py             # Helps analyze SDK format
```

---

## Converting SDK Dumps

If you have a fresh SDK dump from Dumper-7 and want to update the data:

```bash
cd "SDK Data Converter"

# Point it at your SDK folder
python convert_sdk.py "path/to/SDK-Extracted" -o "../Latest/Data"

# Update the offsets
python create_globals.py

# If you're unsure about the format, run this first
python analysis.py
```

The data format is pretty straightforward:

**sdk_data.json** - Array of classes:
```json
{
  "N": "AFortPlayerPawn",      // Class name
  "P": "AFortPawn",            // Parent class
  "S": 7312,                   // Size in bytes
  "M": [                       // Members array
    {
      "N": "CurrentWeapon",    // Member name
      "T": "AFortWeapon*",     // Type
      "O": "0x990",            // Offset
      "S": "0x8"               // Size
    }
  ]
}
```

**globals.json** - Offsets and base addresses:
```json
{
  "bases": {
    "UWorld": "0x175448B8",
    "GNames": "0x167B6600"
  },
  "offsets": {
    "APlayerController": {
      "PlayerCameraManager": "0x360"
    }
  }
}
```

---

## How to use it

**Basic stuff:**
1. Search for a class in the sidebar
2. Click it to see all its members
3. Click on any type to jump to that class
4. Use the filter box to search within the current class

**Tips:**
- Drag the sidebar edge to resize it (kinda lags rn)
- The URL updates when you select a class, so you can bookmark or share specific ones
- Search works with fuzzy matching, so typos are fine (i plan on adding advanced searching later on)
- On mobile, tap the menu icon to show/hide the sidebar
- If data is stale, open the devtools console and run `ClearCache()`

**For developers:**

The browser exposes some useful stuff in the console:

```javascript
// Get base addresses and offsets
window.globals.base('UWorld')
window.globals.offset('AFortPawn', 'Mesh')

// Access raw data
Classes              // All SDK classes
window.AcediaGlobals // Raw globals object

// Clear cache
ClearCache()
```

---

## Technical stuff

**How it stays fast:**
- Virtual scrolling - only renders what's on screen (so yeah, 100k+ items no problem)
- Batched loading - chunks of 1000 classes at a time so your browser doesn't freeze
- Local caching - saves to localStorage for 24 hours
- Debounced search - waits 300ms after you stop typing before filtering
- Levenshtein distance for fuzzy matching

**Browser support:**

Works in Chrome, Firefox, Safari, and Edge. Pretty much anything modern. Safari needs the `-webkit-` prefix for backdrop filters but otherwise everything works.

**Dependencies:**

Literally none. No React, no Vue, no jQuery, no nothing. Just vanilla JavaScript and CSS. The only external thing is Google Fonts for the typography.

---

## Customization

**Want to change the colors?**

Edit the CSS variables in `Latest/styles.css`:

```css
:root {
    --bg-main: #0a0a0a;
    --accent: #6366f1;
    --text-1: #fafafa;
}
```

**Want to add your own offsets?**

Just edit `Latest/Data/globals.json` or use the Python scripts:

```json
{
  "bases": {
    "YourOffset": "0xDEADBEEF"
  }
}
```

---

## Current SDK Info

This is for **Fortnite 38.11-CL**

- About 15,000 classes
- Around 250,000 members total
- 50+ critical offsets
- ~60MB of data (uncompressed)
- Loads in under 3 seconds first time, then instant with cache

---

## Contributing

If you want to help out:

- Found a bug? Open an issue
- Have an idea? Suggest it
- Want to add something? PR it

**Setup:**
```bash
git clone https://github.com/YOUR_USERNAME/Neptune-SDK-Browser.git
cd Neptune-SDK-Browser

# Make your changes, test with any HTTP server
# Then commit and PR

git add .
git commit -m "fix: whatever you fixed"
git push origin your-branch
```

**Guidelines:**
- Keep it vanilla JS (no frameworks)
- Try to match the existing code style
- Comment anything non-obvious
- Test in different browsers if you can

---

## License

MIT - do whatever you want with it. See [LICENSE](LICENSE) for the legal stuff.

---

## Disclaimer

This is for educational/research purposes. Neptune is just a viewer - it doesn't interact with the game at all. That said, using SDK information to build cheats probably violates Epic's TOS, so use your brain. I'm not responsible for what you do with this.

Not affiliated with Epic Games or Fortnite in any way.

---

## Contact/Info

- Issues/Features: [GitHub Issues](https://github.com/paysonism/Neptune-SDK-Browser/issues)
- Discord User: [@payson_.](https://discord.com/users/1214355385457188926)
- Live version: [fnsdk.getneptune.tech](http://fnsdk.getneptune.tech)

---

<div align="center">

Made by [Payson](https://github.com/paysonism)

Please star this repository. I work hard on getting SDK updates for you guys!

[Back to top](#-neptune-sdk-browser)

</div>
