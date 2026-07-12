# Better Intra

Better Intra adds quality-of-life features to the 42 Intra v3 experience.

### 📅 Logtime
Replace the default logtime view with a monthly calendar showing your logged hours at a glance. Each month is a colour-coded grid — darker means more hours per day. Set a monthly goal (default 140h) and see a progress bar with your percentage and remaining hours. Track your daily average, last active date, and optionally use emoji-mode to gamify your hours. Fully customisable colours and animations. Subscribed 42 events appear as markers on your logtime calendar days.

### 🖥️ Clusters
See directional arrows on the cluster map showing which way each seat faces (works for all campuses with submitted cluster data). Switch between clusters with a dropdown, toggle arrows on/off, and set a default cluster that loads automatically. Your campus is auto-detected — no manual setup needed.

### 👤 Profile
Personalise your profile with custom avatar, banner, and background images — click your avatar to open the customisation panel. Choose from 30+ theme presets (synthwave, dracula, cyberpunk, garden, neon, soap, citrus, and more) that recolor your profile badges and accents. Reorder or hide dashboard cards (Logtime, Agenda, Evaluations, Projects, Achievements) by dragging them. Wallet, level, rank, score, and seat show as coloured badges below the profile header — click wallet to open the 42 shop. Filter your agenda by campus and event type. Click any seat label to jump to the cluster map with that seat highlighted. The Projects card uses colour-coded badges (green for projects, red for exams) for quick scanning. The Thursday Roulette card also shows your monthly evaluation history as a corrector.

### 🔗 Shortcuts
Add up to 8 quick-access links displayed as colourful buttons on your profile. Each link can have a name, URL, custom colour, and optional emoji. Site icons load automatically when no emoji is set. Text colour (black or white) is chosen for readability.

### 👥 Friends
Access a friends panel from a button in the bottom-right corner. Add friends by login, see their avatar, level bar, wallet, correction points, and online status. Sort by online status, name, level, wallet, or evaluation points. The button badge shows how many friends are online. A follow/unfollow button appears next to the role dropdown on any user's profile, letting you manage friends without opening the full widget. Requires cloud sync.

### ☁️ Cloud Sync (optional)
Authenticate with your 42 Intra account via the Cloudflare Worker to sync settings across devices. Push, pull, or enable auto-push from the hub footer to automatically sync your settings on reload. Synced visuals (avatar, banner, background) become visible to other Better Intra users viewing your profile.

### 📅 Calendar Sync ☁️
Subscribe to your 42 events in any calendar app via a private ICS subscription URL. Scan the QR code for easy mobile setup. Events auto-sync on profile visit. Configure from the Calendar tab.

### 🔔 Evaluations ☁️
Discord DM notifications when your evaluations are booked or correcteds are revealed. The Cloudflare Worker runs every 5 minutes and sends DMs directly via the Better Intra bot — no browser polling needed. Connect your Discord account from the Discord tab — auto-joins Le Bassin to enable direct messages. Quiet hours let you pause notifications during specified hours. 42 sign-in required.

### ⚙️ Settings Hub
All extension settings in one place, accessible from the gear icon on the intra sidebar. Tabs for Logtime, Clusters, Profile, Shortcuts, Discord, Calendar, Advanced, and About. The footer shows your theme toggle, cloud connection status, last sync badge, and auto-push toggle. Export, import, or reset all settings from the Advanced tab. Turn features on/off or reset settings to default.

---

**Privacy**: All settings are stored locally. Cloud sync is optional and opt-in. No analytics, tracking, or advertising. See the full privacy policy on GitHub at https://api.betterintra.com.
