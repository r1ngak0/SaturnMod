
require('dotenv').config();
 
const {
  Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder,
  TextInputStyle, PermissionFlagsBits, Collection,
} = require('discord.js');
 
const { Player } = require('discord-player');
const { DefaultExtractors } = require('@discord-player/extractor');
const SpotifyWebApi = require('spotify-web-api-node');
 
// ══════════════════════════════════════════════════════
//  CONFIG
// ══════════════════════════════════════════════════════
const CONFIG = {
  MIN_AGE: 16,
  APPLICATIONS_CHANNEL_ID: process.env.APPLICATIONS_CHANNEL_ID || 'YOUR_APPLICATIONS_CHANNEL_ID',
  ADMIN_IDS: (process.env.ADMIN_IDS || 'YOUR_ADMIN_USER_ID').split(','),
  PREFIX: '!',
  SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID || '',
  SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET || '',
  WARN_KICK_THRESHOLD: 3,
};
 
// ══════════════════════════════════════════════════════
//  CLIENT
// ══════════════════════════════════════════════════════
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});
 
// ══════════════════════════════════════════════════════
//  DISCORD PLAYER
// ══════════════════════════════════════════════════════
const player = new Player(client);
 
player.events.on('playerStart', (queue, track) => {
  queue.metadata?.channel?.send({ embeds: [
    new EmbedBuilder().setColor(0x1DB954).setTitle('▶️ Now Playing')
      .setDescription(`**[${track.title}](${track.url})**\nDuration: ${track.duration}`)
      .setTimestamp()
  ]});
});
 
player.events.on('emptyQueue', (queue) => {
  queue.metadata?.channel?.send('✅ Queue finished!');
});
 
player.events.on('error', (queue, error) => {
  console.error('Player error:', error.message);
});
 
// ══════════════════════════════════════════════════════
//  IN-MEMORY STORES
// ══════════════════════════════════════════════════════
const warnings = new Collection();
 
// ══════════════════════════════════════════════════════
//  SPOTIFY CLIENT
// ══════════════════════════════════════════════════════
const spotifyApi = new SpotifyWebApi({
  clientId: CONFIG.SPOTIFY_CLIENT_ID,
  clientSecret: CONFIG.SPOTIFY_CLIENT_SECRET,
});
 
async function refreshSpotifyToken() {
  try {
    const data = await spotifyApi.clientCredentialsGrant();
    spotifyApi.setAccessToken(data.body['access_token']);
    setTimeout(refreshSpotifyToken, (data.body['expires_in'] - 60) * 1000);
  } catch (e) {
    console.error('Spotify token error:', e.message);
    setTimeout(refreshSpotifyToken, 60_000);
  }
}
 
// ══════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════
const modEmbed = (title, desc, color = 0x5865F2) =>
  new EmbedBuilder().setColor(color).setTitle(title).setDescription(desc).setTimestamp();
 
const requireMod = (msg) => msg.member.permissions.has(PermissionFlagsBits.ModerateMembers);
const requireAdmin = (msg) => msg.member.permissions.has(PermissionFlagsBits.Administrator);
 
async function resolveMember(message, args) {
  const mention = args[0];
  if (!mention) return null;
  const id = mention.replace(/[<@!>]/g, '');
  try { return await message.guild.members.fetch(id); } catch { return null; }
}
 
function getWarnings(guildId, userId) {
  if (!warnings.has(guildId)) warnings.set(guildId, new Collection());
  const g = warnings.get(guildId);
  if (!g.has(userId)) g.set(userId, []);
  return g.get(userId);
}
 
// ══════════════════════════════════════════════════════
//  READY
// ══════════════════════════════════════════════════════
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
 
  // Register all default extractors (YouTube, SoundCloud, etc.)
  await player.extractors.loadMulti(DefaultExtractors);
  console.log('🎵 Music player ready');
 
  if (CONFIG.SPOTIFY_CLIENT_ID && CONFIG.SPOTIFY_CLIENT_SECRET) {
    await refreshSpotifyToken();
    console.log('🎧 Spotify connected');
  }
});
 
// ══════════════════════════════════════════════════════
//  MESSAGE COMMANDS
// ══════════════════════════════════════════════════════
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(CONFIG.PREFIX)) return;
 
  const args = message.content.slice(CONFIG.PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();
 
  // ──────────────────────────────────────
  //  APPLICATION
  // ──────────────────────────────────────
  if (cmd === 'apply') {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🛡️ Moderator Application')
      .setDescription(
        `Want to join the moderation team? Click the button below!\n\n` +
        `**Requirements:**\n` +
        `• Must be **${CONFIG.MIN_AGE}+ years old**\n` +
        `• Active community member\n` +
        `• Good communication skills\n` +
        `• Dedication to keeping the server safe`
      )
      .setFooter({ text: 'Applications are reviewed by the admin team.' })
      .setTimestamp();
 
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('open_mod_application')
        .setLabel('Apply for Moderator')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🛡️')
    );
    return message.reply({ embeds: [embed], components: [row] });
  }
 
  if (cmd === 'apphelp') {
    if (!requireAdmin(message)) return message.reply('🚫 Admins only.');
    return message.reply(
      `**Bot Config:**\n` +
      `• Min age: **${CONFIG.MIN_AGE}+**\n` +
      `• Applications channel: <#${CONFIG.APPLICATIONS_CHANNEL_ID}>\n` +
      `• Admin DMs: ${CONFIG.ADMIN_IDS.map(id => `<@${id}>`).join(', ')}`
    );
  }
 
  // ──────────────────────────────────────
  //  MODERATION
  // ──────────────────────────────────────
  if (cmd === 'ban') {
    if (!requireMod(message)) return message.reply('🚫 You need Moderate Members permission.');
    const target = await resolveMember(message, args);
    if (!target) return message.reply('❌ User not found.');
    const reason = args.slice(1).join(' ') || 'No reason provided';
    try {
      await target.ban({ reason, deleteMessageSeconds: 86400 });
      return message.channel.send({ embeds: [modEmbed('🔨 Member Banned', `**${target.user.tag}** was banned.\n**Reason:** ${reason}`, 0xED4245)] });
    } catch (e) { return message.reply(`❌ Could not ban: ${e.message}`); }
  }
 
  if (cmd === 'kick') {
    if (!requireMod(message)) return message.reply('🚫 You need Moderate Members permission.');
    const target = await resolveMember(message, args);
    if (!target) return message.reply('❌ User not found.');
    const reason = args.slice(1).join(' ') || 'No reason provided';
    try {
      await target.kick(reason);
      return message.channel.send({ embeds: [modEmbed('👢 Member Kicked', `**${target.user.tag}** was kicked.\n**Reason:** ${reason}`, 0xFEE75C)] });
    } catch (e) { return message.reply(`❌ Could not kick: ${e.message}`); }
  }
 
  if (cmd === 'mute') {
    if (!requireMod(message)) return message.reply('🚫 You need Moderate Members permission.');
    const target = await resolveMember(message, args);
    if (!target) return message.reply('❌ User not found.');
    const minutes = parseInt(args[1]) || 10;
    const reason = args.slice(2).join(' ') || 'No reason provided';
    const ms = minutes * 60 * 1000;
    if (ms > 28 * 24 * 60 * 60 * 1000) return message.reply('❌ Timeout cannot exceed 28 days.');
    try {
      await target.timeout(ms, reason);
      return message.channel.send({ embeds: [modEmbed('🔇 Member Muted', `**${target.user.tag}** muted for **${minutes} min**.\n**Reason:** ${reason}`, 0xFEE75C)] });
    } catch (e) { return message.reply(`❌ Could not mute: ${e.message}`); }
  }
 
  if (cmd === 'unmute') {
    if (!requireMod(message)) return message.reply('🚫 You need Moderate Members permission.');
    const target = await resolveMember(message, args);
    if (!target) return message.reply('❌ User not found.');
    try {
      await target.timeout(null);
      return message.channel.send({ embeds: [modEmbed('🔊 Member Unmuted', `**${target.user.tag}** has been unmuted.`, 0x57F287)] });
    } catch (e) { return message.reply(`❌ Could not unmute: ${e.message}`); }
  }
 
  if (cmd === 'warn') {
    if (!requireMod(message)) return message.reply('🚫 You need Moderate Members permission.');
    const target = await resolveMember(message, args);
    if (!target) return message.reply('❌ User not found.');
    const reason = args.slice(1).join(' ') || 'No reason provided';
    const userWarns = getWarnings(message.guild.id, target.id);
    userWarns.push({ reason, date: new Date().toISOString(), by: message.author.tag });
    const count = userWarns.length;
 
    await message.channel.send({ embeds: [modEmbed(
      `⚠️ Member Warned (${count}/${CONFIG.WARN_KICK_THRESHOLD})`,
      `**${target.user.tag}** has been warned.\n**Reason:** ${reason}`, 0xFEE75C
    )]});
 
    try { await target.send({ embeds: [modEmbed('⚠️ You have been warned', `**Server:** ${message.guild.name}\n**Reason:** ${reason}\n**Warning count:** ${count}`, 0xFEE75C)] }); } catch {}
 
    if (count >= CONFIG.WARN_KICK_THRESHOLD) {
      try {
        await target.kick(`Auto-kicked: reached ${CONFIG.WARN_KICK_THRESHOLD} warnings`);
        await message.channel.send({ embeds: [modEmbed('👢 Auto-Kicked', `**${target.user.tag}** was auto-kicked after **${CONFIG.WARN_KICK_THRESHOLD} warnings**.`, 0xED4245)] });
        warnings.get(message.guild.id).delete(target.id);
      } catch (e) { await message.reply(`⚠️ Could not auto-kick: ${e.message}`); }
    }
    return;
  }
 
  if (cmd === 'warnings') {
    if (!requireMod(message)) return message.reply('🚫 You need Moderate Members permission.');
    const target = await resolveMember(message, args);
    if (!target) return message.reply('❌ User not found.');
    const userWarns = getWarnings(message.guild.id, target.id);
    if (!userWarns.length) return message.reply(`✅ **${target.user.tag}** has no warnings.`);
    const list = userWarns.map((w, i) => `**${i + 1}.** ${w.reason} _(by ${w.by} — ${w.date.slice(0, 10)})_`).join('\n');
    return message.channel.send({ embeds: [modEmbed(`⚠️ Warnings for ${target.user.tag}`, list, 0xFEE75C)] });
  }
 
  if (cmd === 'clearwarns') {
    if (!requireAdmin(message)) return message.reply('🚫 Admins only.');
    const target = await resolveMember(message, args);
    if (!target) return message.reply('❌ User not found.');
    if (warnings.has(message.guild.id)) warnings.get(message.guild.id).delete(target.id);
    return message.reply({ embeds: [modEmbed('✅ Warnings Cleared', `All warnings for **${target.user.tag}** cleared.`, 0x57F287)] });
  }
 
  // ──────────────────────────────────────
  //  MUSIC
  // ──────────────────────────────────────
  if (cmd === 'play') {
    if (!args.length) return message.reply('❌ Usage: `!play <Spotify URL or song name>`');
 
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.reply('❌ Join a voice channel first!');
 
    let query = args.join(' ');
 
    // Resolve Spotify URL → track name
    const spotifyMatch = query.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/);
    if (spotifyMatch) {
      if (!CONFIG.SPOTIFY_CLIENT_ID) return message.reply('❌ Spotify credentials not set. Use a song name instead.');
      try {
        const trackData = await spotifyApi.getTrack(spotifyMatch[1]);
        const t = trackData.body;
        query = `${t.name} ${t.artists[0].name}`;
        await message.reply({ embeds: [modEmbed('🎧 Spotify Track', `Found **${t.name}** by ${t.artists.map(a => a.name).join(', ')}\nSearching...`, 0x1DB954)] });
      } catch (e) { return message.reply(`❌ Spotify error: ${e.message}`); }
    }
 
    const msg = await message.reply('🔍 Searching...');
 
    try {
      const { track } = await player.play(voiceChannel, query, {
        nodeOptions: {
          metadata: { channel: message.channel },
          selfDeaf: true,
        },
      });
 
      await msg.edit({ content: '', embeds: [
        modEmbed('➕ Added to Queue', `**[${track.title}](${track.url})**\nDuration: ${track.duration}`, 0x5865F2)
      ]});
    } catch (e) {
      console.error('Play error:', e.message);
      await msg.edit(`❌ Could not play: ${e.message}`);
    }
    return;
  }
 
  if (cmd === 'skip') {
    const queue = player.nodes.get(message.guild.id);
    if (!queue || !queue.isPlaying()) return message.reply('❌ Nothing is playing.');
    queue.node.skip();
    return message.reply({ embeds: [modEmbed('⏭️ Skipped', 'Skipped the current track.', 0x5865F2)] });
  }
 
  if (cmd === 'stop') {
    const queue = player.nodes.get(message.guild.id);
    if (!queue) return message.reply('❌ Nothing is playing.');
    queue.delete();
    return message.reply({ embeds: [modEmbed('⏹️ Stopped', 'Music stopped and queue cleared.', 0xED4245)] });
  }
 
  if (cmd === 'pause') {
    const queue = player.nodes.get(message.guild.id);
    if (!queue || !queue.isPlaying()) return message.reply('❌ Nothing is playing.');
    queue.node.pause();
    return message.reply({ embeds: [modEmbed('⏸️ Paused', 'Use `!resume` to continue.', 0xFEE75C)] });
  }
 
  if (cmd === 'resume') {
    const queue = player.nodes.get(message.guild.id);
    if (!queue) return message.reply('❌ Nothing is playing.');
    queue.node.resume();
    return message.reply({ embeds: [modEmbed('▶️ Resumed', 'Music resumed.', 0x57F287)] });
  }
 
  if (cmd === 'queue') {
    const queue = player.nodes.get(message.guild.id);
    if (!queue || (!queue.isPlaying() && !queue.tracks.size)) return message.reply('📭 The queue is empty.');
    const current = queue.currentTrack;
    const tracks = queue.tracks.toArray().slice(0, 10);
    const nowPlaying = current ? `▶️ **Now:** [${current.title}](${current.url})\n\n` : '';
    const upcoming = tracks.length
      ? tracks.map((t, i) => `**${i + 1}.** [${t.title}](${t.url}) — ${t.duration}`).join('\n')
      : '_No upcoming tracks_';
    const embed = modEmbed('🎵 Queue', nowPlaying + upcoming, 0x5865F2);
    if (queue.tracks.size > 10) embed.setFooter({ text: `+ ${queue.tracks.size - 10} more` });
    return message.channel.send({ embeds: [embed] });
  }
 
  if (cmd === 'np') {
    const queue = player.nodes.get(message.guild.id);
    if (!queue || !queue.currentTrack) return message.reply('❌ Nothing is playing.');
    const t = queue.currentTrack;
    return message.reply({ embeds: [modEmbed('🎵 Now Playing', `**[${t.title}](${t.url})**\nDuration: ${t.duration}`, 0x1DB954)] });
  }
 
  if (cmd === 'leave') {
    const queue = player.nodes.get(message.guild.id);
    if (queue) queue.delete();
    return message.reply('👋 Left the voice channel.');
  }
 
  if (cmd === 'help') {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📖 Bot Commands')
      .addFields(
        { name: '🛡️ Applications', value: '`!apply` — Post the mod application button\n`!apphelp` — Config info (admin)' },
        {
          name: '🔨 Moderation _(requires Moderate Members)_',
          value: [
            '`!ban @user [reason]` — Ban a member',
            '`!kick @user [reason]` — Kick a member',
            '`!mute @user [minutes] [reason]` — Timeout a member',
            '`!unmute @user` — Remove timeout',
            '`!warn @user [reason]` — Issue a warning (auto-kick at 3)',
            '`!warnings @user` — View warnings',
            '`!clearwarns @user` — Clear warnings (admin)',
          ].join('\n'),
        },
        {
          name: '🎵 Music',
          value: [
            '`!play <Spotify URL or song name>` — Play a track',
            '`!skip` — Skip current track',
            '`!stop` — Stop & clear queue',
            '`!pause` / `!resume` — Pause/resume',
            '`!queue` — Show queue',
            '`!np` — Now playing',
            '`!leave` — Leave voice channel',
          ].join('\n'),
        },
      )
      .setFooter({ text: `Prefix: ${CONFIG.PREFIX}` })
      .setTimestamp();
    return message.channel.send({ embeds: [embed] });
  }
});
 
// ══════════════════════════════════════════════════════
//  INTERACTIONS
// ══════════════════════════════════════════════════════
client.on('interactionCreate', async (interaction) => {
 
  if (interaction.isButton() && interaction.customId === 'open_mod_application') {
    const modal = new ModalBuilder().setCustomId('mod_application_modal').setTitle('Moderator Application');
    const fields = [
      new TextInputBuilder().setCustomId('age').setLabel(`Your age (must be ${CONFIG.MIN_AGE}+)`).setStyle(TextInputStyle.Short).setPlaceholder('e.g. 18').setRequired(true).setMinLength(2).setMaxLength(3),
      new TextInputBuilder().setCustomId('timezone').setLabel('Your timezone').setStyle(TextInputStyle.Short).setPlaceholder('e.g. UTC+2, EST, PST').setRequired(true).setMaxLength(30),
      new TextInputBuilder().setCustomId('experience').setLabel('Previous moderation experience').setStyle(TextInputStyle.Paragraph).setPlaceholder('Describe past experience, or write "None".').setRequired(true).setMaxLength(500),
      new TextInputBuilder().setCustomId('why').setLabel('Why do you want to be a moderator?').setStyle(TextInputStyle.Paragraph).setPlaceholder('Tell us your motivation.').setRequired(true).setMaxLength(600),
      new TextInputBuilder().setCustomId('scenario').setLabel('Scenario: user spams slurs. Your response?').setStyle(TextInputStyle.Paragraph).setPlaceholder('Walk us through your step-by-step response.').setRequired(true).setMaxLength(500),
    ];
    modal.addComponents(fields.map(f => new ActionRowBuilder().addComponents(f)));
    return interaction.showModal(modal);
  }
 
  if (interaction.isModalSubmit() && interaction.customId === 'mod_application_modal') {
    await interaction.deferReply({ ephemeral: true });
    const age = parseInt(interaction.fields.getTextInputValue('age'), 10);
    const timezone = interaction.fields.getTextInputValue('timezone');
    const experience = interaction.fields.getTextInputValue('experience');
    const why = interaction.fields.getTextInputValue('why');
    const scenario = interaction.fields.getTextInputValue('scenario');
 
    if (isNaN(age) || age < CONFIG.MIN_AGE) {
      return interaction.editReply({ content: `❌ You must be at least **${CONFIG.MIN_AGE} years old** to apply. Application not submitted.` });
    }
 
    const appEmbed = new EmbedBuilder()
      .setColor(0x57F287).setTitle('📋 New Moderator Application')
      .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
      .addFields(
        { name: '👤 Applicant', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
        { name: '🆔 User ID', value: interaction.user.id, inline: true },
        { name: '🎂 Age', value: `${age}`, inline: true },
        { name: '🌍 Timezone', value: timezone, inline: true },
        { name: '📅 Applied At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
        { name: '🏆 Previous Experience', value: experience },
        { name: '💡 Why They Want to Mod', value: why },
        { name: '🚨 Scenario Response', value: scenario },
      )
      .setFooter({ text: `Server: ${interaction.guild.name}` }).setTimestamp();
 
    const reviewRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`approve_${interaction.user.id}`).setLabel('Approve').setStyle(ButtonStyle.Success).setEmoji('✅'),
      new ButtonBuilder().setCustomId(`deny_${interaction.user.id}`).setLabel('Deny').setStyle(ButtonStyle.Danger).setEmoji('❌'),
    );
 
    let sent = false;
    try {
      const ch = await interaction.guild.channels.fetch(CONFIG.APPLICATIONS_CHANNEL_ID);
      if (ch?.isTextBased()) { await ch.send({ embeds: [appEmbed], components: [reviewRow] }); sent = true; }
    } catch (e) { console.error('Channel error:', e.message); }
 
    for (const adminId of CONFIG.ADMIN_IDS) {
      try {
        const admin = await client.users.fetch(adminId.trim());
        await admin.send({ content: `📬 New mod application from **${interaction.guild.name}**!`, embeds: [appEmbed], components: [reviewRow] });
        sent = true;
      } catch (e) { console.error(`DM error ${adminId}:`, e.message); }
    }
 
    return interaction.editReply({ content: sent
      ? '✅ **Application submitted!** The team will review it soon. Thank you!'
      : '⚠️ Application processed but delivery failed. Contact an admin directly.' });
  }
 
  if (interaction.isButton()) {
    const [action, targetId] = interaction.customId.split('_');
    if (!['approve', 'deny'].includes(action) || !targetId) return;
 
    const isAdmin = CONFIG.ADMIN_IDS.includes(interaction.user.id) || interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);
    if (!isAdmin) return interaction.reply({ content: '🚫 Admins only.', ephemeral: true });
 
    const verb = action === 'approve' ? 'Approved ✅' : 'Denied ❌';
    const color = action === 'approve' ? 0x57F287 : 0xED4245;
    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setColor(color).setFooter({ text: `${verb} by ${interaction.user.tag}` });
    await interaction.update({ embeds: [updatedEmbed], components: [] });
 
    try {
      const applicant = await client.users.fetch(targetId);
      await applicant.send({ embeds: [new EmbedBuilder().setColor(color)
        .setTitle(action === 'approve' ? '🎉 Application Approved!' : '📋 Application Update')
        .setDescription(action === 'approve'
          ? `Congratulations! Your moderator application for **${interaction.guild?.name || 'the server'}** has been **approved**. Welcome to the team! 🛡️`
          : `Thank you for applying to **${interaction.guild?.name || 'the server'}**. Your application was not accepted at this time — feel free to apply again in the future!`)
        .setTimestamp()] });
    } catch (e) { console.error('DM applicant error:', e.message); }
 
    return interaction.followUp({ content: `Application **${verb}** — applicant notified.`, ephemeral: true });
  }
});
 
client.login(process.env.BOT_TOKEN);