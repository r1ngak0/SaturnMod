# Saturn
Moderation, application and music Discord bot
🛡️🎵 Discord Bot — Applications + Moderation + Music
A full-featured Discord bot with three modules:

Mod Applications — form-based applications with age gate (16+)
Moderation — ban, kick, mute, warn system with auto-kick
Music — Spotify URL support + song name search, queue system


Setup
1. Create a Discord Bot

Go to discord.com/developers/applications
New Application → name it
Bot tab → Add Bot → copy the Token
Enable Privileged Gateway Intents: Server Members Intent + Message Content Intent
OAuth2 → URL Generator — select scopes: bot, permissions: Administrator (or granular: Send Messages, Ban Members, Kick Members, Moderate Members, Read Messages, Embed Links, Connect, Speak)
Open the invite URL to add the bot to your server

2. Spotify Credentials (for !play <Spotify URL>)

Go to developer.spotify.com/dashboard
Create an app → copy Client ID and Client Secret
Add them to your .env file


Note: Without Spotify credentials, !play still works with song name searches.

3. Install & Run
bash# Install system dependency (needed for voice)
# Linux:
sudo apt-get install -y ffmpeg
# macOS:
brew install ffmpeg

# Install Node.js packages
npm install

# Copy and fill in your env file
cp .env.example .env
# Edit .env with your tokens and IDs

# Start the bot
npm start

Commands
🛡️ Applications
CommandDescription!applyPosts the Apply for Moderator button!apphelpShows bot config (admin only)
🔨 Moderation (requires Moderate Members permission)
CommandDescription!ban @user [reason]Ban a member!kick @user [reason]Kick a member!mute @user [minutes] [reason]Timeout a member (default 10 min)!unmute @userRemove timeout!warn @user [reason]Issue a warning (auto-kicks at 3 warns)!warnings @userView a member's warnings!clearwarns @userClear all warnings (admin only)
🎵 Music
CommandDescription!play <Spotify URL or song name>Play a track / add to queue!skipSkip current track!stopStop music and clear queue!pausePause playback!resumeResume playback!queueShow the queue!npShow now playing!leaveLeave the voice channel
ℹ️ General
CommandDescription!helpShow all commands

Notes

Warnings are stored in memory — they reset when the bot restarts. For persistence, add a database (e.g. SQLite with better-sqlite3).
Music plays audio via YouTube search behind the scenes — Spotify URLs are resolved to a track name + artist, then searched on YouTube.
The bot auto-leaves the voice channel after 30 seconds of silenc