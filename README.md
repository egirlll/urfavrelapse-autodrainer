# Relapse Bait's Auto-Drain Extension

Auto-drain extension for https://throne.com/relapsebaitt

## Setup

1. **Enable Developer Mode in Chrome**
   - Go to `chrome://extensions/`
   - Toggle "Developer mode" ON (top right)

2. **Load the Extension**
   - Click "Load unpacked"
   - Select this `main-autodrainer-main` folder
   - Extension loads with icon in toolbar

3. **Run the Drain**
   - Go to https://throne.com/relapsebaitt
   - Click the extension icon
   - Select an item when modal appears
   - Extension auto-drains: add to cart → checkout → pay

## Items

List is now dynamically built based on any "Add to cart" item on the page

## Features

- Select item once, remembers choice
- Auto-clicks add to cart
- Auto-opens checkout
- Auto-submits payment
- Spawns images/videos
- Loops continuously until tab is closed

## Media Setup

Images & videos are automatically pulled from the media service (defined by `const MEDIA_SERVICE` in content.js)

## Notes

- Make sure card details are saved in Throne beforehand
- Extension runs only on throne.com/relapsebaitt
- Close tab to stop draining