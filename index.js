if (typeof File === 'undefined') {
  const { Blob } = require('buffer');
  global.File = class File extends Blob {
    constructor(chunks, filename, opts = {}) {
      super(chunks, opts);
      this.name = filename;
      this.lastModified = opts.lastModified ?? Date.now();
    }
  };
}
 
require('dotenv').config();
 
const {
  Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder,
  TextInputStyle, PermissionFlagsBits, Collection,
  REST, Routes, SlashCommandBuilder, ApplicationCommandOptionType,
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
//  SLASH COMMAND DEFINITIONS
// ══════════════════════════════════════════════════════
const slashCommands = [
  // Applications
  new SlashCommandBuilder()
    .setName('apply')
    .setDescription('Опубликовать кнопку заявки на модератора'),
 
  new SlashCommandBuilder()
    .setName('apphelp')
    .setDescription('Показать конфигурацию бота (только для администраторов)'),
 
  // Moderation
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Забанить участника')
    .addUserOption(o => o.setName('user').setDescription('Участник для бана').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Причина бана'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
 
  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Кикнуть участника')
    .addUserOption(o => o.setName('user').setDescription('Участник для кика').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Причина кика'))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
 
  new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Замьютить участника (тайм-аут)')
    .addUserOption(o => o.setName('user').setDescription('Участник для мьюта').setRequired(true))
    .addIntegerOption(o => o.setName('minutes').setDescription('Длительность в минутах (по умолчанию 10)').setMinValue(1).setMaxValue(40320))
    .addStringOption(o => o.setName('reason').setDescription('Причина мьюта'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
 
  new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Снять мьют с участника')
    .addUserOption(o => o.setName('user').setDescription('Участник для снятия мьюта').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
 
  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Выдать предупреждение участнику')
    .addUserOption(o => o.setName('user').setDescription('Участник').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Причина предупреждения'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
 
  new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('Просмотреть предупреждения участника')
    .addUserOption(o => o.setName('user').setDescription('Участник').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
 
  new SlashCommandBuilder()
    .setName('clearwarns')
    .setDescription('Сбросить все предупреждения участника (только для администраторов)')
    .addUserOption(o => o.setName('user').setDescription('Участник').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
 
  // Music
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Играть трек или добавить в очередь')
    .addStringOption(o => o.setName('query').setDescription('Spotify URL или название песни').setRequired(true)),
 
  new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Пропустить текущий трек'),
 
  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Остановить музыку и очистить очередь'),
 
  new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Поставить воспроизведение на паузу'),
 
  new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Возобновить воспроизведение'),
 
  new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Показать текущую очередь'),
 
  new SlashCommandBuilder()
    .setName('np')
    .setDescription('Показать текущий трек'),
 
  new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Покинуть голосовой канал'),
 
  // General
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Показать все команды бота'),
].map(cmd => cmd.toJSON());
 
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
    new EmbedBuilder().setColor(0x1DB954).setTitle('▶️ Сейчас играет')
      .setDescription(`**[${track.title}](${track.url})**\nДлительность: ${track.duration}`)
      .setTimestamp()
  ]});
});
 
player.events.on('emptyQueue', (queue) => {
  queue.metadata?.channel?.send('✅ Очередь завершена!');
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
 
const requireMod = (member) => member.permissions.has(PermissionFlagsBits.ModerateMembers);
const requireAdmin = (member) => member.permissions.has(PermissionFlagsBits.Administrator);
 
// For prefix commands: resolve a member from a mention/ID in args
async function resolveMemberFromArgs(guild, args) {
  const mention = args[0];
  if (!mention) return null;
  const id = mention.replace(/[<@!>]/g, '');
  try { return await guild.members.fetch(id); } catch { return null; }
}
 
function getWarnings(guildId, userId) {
  if (!warnings.has(guildId)) warnings.set(guildId, new Collection());
  const g = warnings.get(guildId);
  if (!g.has(userId)) g.set(userId, []);
  return g.get(userId);
}
 
// ══════════════════════════════════════════════════════
//  SHARED COMMAND LOGIC
//  Each handler accepts a unified context object and
//  returns a reply payload (or sends directly).
// ══════════════════════════════════════════════════════
 
async function handleApply(ctx) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🛡️ Заявка на модератора')
    .setDescription(
      `Want to join the moderation team? Click the button below!\n\n` +
      `**Requirements:**\n` +
      `• Должен быть **${CONFIG.MIN_AGE}+**\n` +
      `• Active community member\n` +
      `• Good communication skills\n` +
      `• Dedication to keeping the server safe`
    )
    .setFooter({ text: 'Заявки рассматриваются командой администраторов.' })
    .setTimestamp();
 
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('open_mod_application')
      .setLabel('Подать заявку')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🛡️')
  );
  return ctx.reply({ embeds: [embed], components: [row] });
}
 
async function handleAppHelp(ctx) {
  if (!requireAdmin(ctx.member)) return ctx.reply({ content: '🚫 Только для администраторов.', ephemeral: true });
  return ctx.reply({
    content:
      `**Конфигурация бота:**\n` +
      `• Мин. возраст: **${CONFIG.MIN_AGE}+**\n` +
      `• Канал заявок: <#${CONFIG.APPLICATIONS_CHANNEL_ID}>\n` +
      `• Администраторы: ${CONFIG.ADMIN_IDS.map(id => `<@${id}>`).join(', ')}`,
    ephemeral: true,
  });
}
 
async function handleBan(ctx) {
  if (!requireMod(ctx.member)) return ctx.reply({ content: '🚫 Нужно право «Управление участниками».', ephemeral: true });
  const target = ctx.target;
  if (!target) return ctx.reply({ content: '❌ Пользователь не найден.', ephemeral: true });
  const reason = ctx.reason || 'Причина не указана';
  try {
    await target.ban({ reason, deleteMessageSeconds: 86400 });
    return ctx.reply({ embeds: [modEmbed('🔨 Участник забанен', `**${target.user.tag}** был забанен.\n**Причина:** ${reason}`, 0xED4245)] });
  } catch (e) {
    return ctx.reply({ content: `❌ Не удалось забанить: ${e.message}`, ephemeral: true });
  }
}
 
async function handleKick(ctx) {
  if (!requireMod(ctx.member)) return ctx.reply({ content: '🚫 Нужно право «Управление участниками».', ephemeral: true });
  const target = ctx.target;
  if (!target) return ctx.reply({ content: '❌ Пользователь не найден.', ephemeral: true });
  const reason = ctx.reason || 'Причина не указана';
  try {
    await target.kick(reason);
    return ctx.reply({ embeds: [modEmbed('👢 Участник кикнут', `**${target.user.tag}** был кикнут.\n**Причина:** ${reason}`, 0xFEE75C)] });
  } catch (e) {
    return ctx.reply({ content: `❌ Не удалось кикнуть: ${e.message}`, ephemeral: true });
  }
}
 
async function handleMute(ctx) {
  if (!requireMod(ctx.member)) return ctx.reply({ content: '🚫 Нужно право «Управление участниками».', ephemeral: true });
  const target = ctx.target;
  if (!target) return ctx.reply({ content: '❌ Пользователь не найден.', ephemeral: true });
  const minutes = ctx.minutes || 10;
  const reason = ctx.reason || 'Причина не указана';
  const ms = minutes * 60 * 1000;
  if (ms > 28 * 24 * 60 * 60 * 1000) return ctx.reply({ content: '❌ Мьют не может превышать 28 дней.', ephemeral: true });
  try {
    await target.timeout(ms, reason);
    return ctx.reply({ embeds: [modEmbed('🔇 Участник замьючен', `**${target.user.tag}** замьючен на **${minutes} мин**.\n**Причина:** ${reason}`, 0xFEE75C)] });
  } catch (e) {
    return ctx.reply({ content: `❌ Не удалось замьютить: ${e.message}`, ephemeral: true });
  }
}
 
async function handleUnmute(ctx) {
  if (!requireMod(ctx.member)) return ctx.reply({ content: '🚫 Нужно право «Управление участниками».', ephemeral: true });
  const target = ctx.target;
  if (!target) return ctx.reply({ content: '❌ Пользователь не найден.', ephemeral: true });
  try {
    await target.timeout(null);
    return ctx.reply({ embeds: [modEmbed('🔊 Мьют снят', `**${target.user.tag}** разамьючен.`, 0x57F287)] });
  } catch (e) {
    return ctx.reply({ content: `❌ Не удалось снять мьют: ${e.message}`, ephemeral: true });
  }
}
 
async function handleWarn(ctx) {
  if (!requireMod(ctx.member)) return ctx.reply({ content: '🚫 Нужно право «Управление участниками».', ephemeral: true });
  const target = ctx.target;
  if (!target) return ctx.reply({ content: '❌ Пользователь не найден.', ephemeral: true });
  const reason = ctx.reason || 'Причина не указана';
  const userWarns = getWarnings(ctx.guild.id, target.id);
  userWarns.push({ reason, date: new Date().toISOString(), by: ctx.authorTag });
  const count = userWarns.length;
 
  await ctx.reply({ embeds: [modEmbed(
    `⚠️ Предупреждение выдано (${count}/${CONFIG.WARN_KICK_THRESHOLD})`,
    `**${target.user.tag}** получил предупреждение.\n**Причина:** ${reason}`, 0xFEE75C
  )]});
 
  try {
    await target.send({ embeds: [modEmbed('⚠️ Вы получили предупреждение',
      `**Сервер:** ${ctx.guild.name}\n**Причина:** ${reason}\n**Кол-во предупреждений:** ${count}`, 0xFEE75C)] });
  } catch {}
 
  if (count >= CONFIG.WARN_KICK_THRESHOLD) {
    try {
      await target.kick(`Авто-кик: достигнуто ${CONFIG.WARN_KICK_THRESHOLD} предупреждений`);
      await ctx.channel.send({ embeds: [modEmbed('👢 Авто-кик',
        `**${target.user.tag}** был авто-кикнут после **${CONFIG.WARN_KICK_THRESHOLD} предупреждений**.`, 0xED4245)] });
      warnings.get(ctx.guild.id).delete(target.id);
    } catch (e) {
      await ctx.channel.send(`⚠️ Не удалось авто-кикнуть: ${e.message}`);
    }
  }
}
 
async function handleWarnings(ctx) {
  if (!requireMod(ctx.member)) return ctx.reply({ content: '🚫 Нужно право «Управление участниками».', ephemeral: true });
  const target = ctx.target;
  if (!target) return ctx.reply({ content: '❌ Пользователь не найден.', ephemeral: true });
  const userWarns = getWarnings(ctx.guild.id, target.id);
  if (!userWarns.length) return ctx.reply({ content: `✅ У **${target.user.tag}** нет предупреждений.`, ephemeral: true });
  const list = userWarns.map((w, i) => `**${i + 1}.** ${w.reason} _(by ${w.by} — ${w.date.slice(0, 10)})_`).join('\n');
  return ctx.reply({ embeds: [modEmbed(`⚠️ Предупреждения ${target.user.tag}`, list, 0xFEE75C)] });
}
 
async function handleClearWarns(ctx) {
  if (!requireAdmin(ctx.member)) return ctx.reply({ content: '🚫 Только для администраторов.', ephemeral: true });
  const target = ctx.target;
  if (!target) return ctx.reply({ content: '❌ Пользователь не найден.', ephemeral: true });
  if (warnings.has(ctx.guild.id)) warnings.get(ctx.guild.id).delete(target.id);
  return ctx.reply({ embeds: [modEmbed('✅ Предупреждения сброшены', `Все предупреждения для **${target.user.tag}** сброшены.`, 0x57F287)] });
}
 
async function handlePlay(ctx) {
  const voiceChannel = ctx.member.voice.channel;
  if (!voiceChannel) return ctx.reply({ content: '❌ Сначала зайди в голосовой канал!', ephemeral: true });
 
  let query = ctx.query;
  if (!query) return ctx.reply({ content: '❌ Использование: `play <Spotify URL или название>`', ephemeral: true });
 
  // Resolve Spotify URL → track name
  const spotifyMatch = query.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/);
  if (spotifyMatch) {
    if (!CONFIG.SPOTIFY_CLIENT_ID) return ctx.reply({ content: '❌ Данные Spotify не настроены. Используй название песни.', ephemeral: true });
    try {
      const trackData = await spotifyApi.getTrack(spotifyMatch[1]);
      const t = trackData.body;
      query = `${t.name} ${t.artists[0].name}`;
      await ctx.reply({ embeds: [modEmbed('🎧 Трек Spotify', `Найдено **${t.name}** — ${t.artists.map(a => a.name).join(', ')}\nПоиск...`, 0x1DB954)] });
    } catch (e) {
      return ctx.reply({ content: `❌ Ошибка Spotify: ${e.message}`, ephemeral: true });
    }
  } else {
    await ctx.reply({ content: '🔍 Ищу...', fetchReply: true });
  }
 
  try {
    const { track } = await player.play(voiceChannel, query, {
      nodeOptions: {
        metadata: { channel: ctx.channel },
        selfDeaf: true,
      },
    });
    await ctx.editReply({ content: '', embeds: [
      modEmbed('➕ Добавлено в очередь', `**[${track.title}](${track.url})**\nДлительность: ${track.duration}`, 0x5865F2)
    ]});
  } catch (e) {
    console.error('Play error:', e.message);
    await ctx.editReply({ content: `❌ Не удалось воспроизвести: ${e.message}` });
  }
}
 
async function handleSkip(ctx) {
  const queue = player.nodes.get(ctx.guild.id);
  if (!queue || !queue.isPlaying()) return ctx.reply({ content: '❌ Ничего не играет.', ephemeral: true });
  queue.node.skip();
  return ctx.reply({ embeds: [modEmbed('⏭️ Пропущено', 'Текущий трек пропущен.', 0x5865F2)] });
}
 
async function handleStop(ctx) {
  const queue = player.nodes.get(ctx.guild.id);
  if (!queue) return ctx.reply({ content: '❌ Ничего не играет.', ephemeral: true });
  queue.delete();
  return ctx.reply({ embeds: [modEmbed('⏹️ Остановлено', 'Музыка остановлена, очередь очищена.', 0xED4245)] });
}
 
async function handlePause(ctx) {
  const queue = player.nodes.get(ctx.guild.id);
  if (!queue || !queue.isPlaying()) return ctx.reply({ content: '❌ Ничего не играет.', ephemeral: true });
  queue.node.pause();
  return ctx.reply({ embeds: [modEmbed('⏸️ Пауза', 'Используй `/resume` для продолжения.', 0xFEE75C)] });
}
 
async function handleResume(ctx) {
  const queue = player.nodes.get(ctx.guild.id);
  if (!queue) return ctx.reply({ content: '❌ Ничего не играет.', ephemeral: true });
  queue.node.resume();
  return ctx.reply({ embeds: [modEmbed('▶️ Воспроизведение возобновлено', 'Музыка возобновлена.', 0x57F287)] });
}
 
async function handleQueue(ctx) {
  const queue = player.nodes.get(ctx.guild.id);
  if (!queue || (!queue.isPlaying() && !queue.tracks.size)) return ctx.reply({ content: '📭 Очередь пуста.', ephemeral: true });
  const current = queue.currentTrack;
  const tracks = queue.tracks.toArray().slice(0, 10);
  const nowPlaying = current ? `▶️ **Now:** [${current.title}](${current.url})\n\n` : '';
  const upcoming = tracks.length
    ? tracks.map((t, i) => `**${i + 1}.** [${t.title}](${t.url}) — ${t.duration}`).join('\n')
    : '_Следующих треков нет_';
  const embed = modEmbed('🎵 Очередь', nowPlaying + upcoming, 0x5865F2);
  if (queue.tracks.size > 10) embed.setFooter({ text: `+ ещё ${queue.tracks.size - 10}` });
  return ctx.reply({ embeds: [embed] });
}
 
async function handleNp(ctx) {
  const queue = player.nodes.get(ctx.guild.id);
  if (!queue || !queue.currentTrack) return ctx.reply({ content: '❌ Ничего не играет.', ephemeral: true });
  const t = queue.currentTrack;
  return ctx.reply({ embeds: [modEmbed('🎵 Сейчас играет', `**[${t.title}](${t.url})**\nДлительность: ${t.duration}`, 0x1DB954)] });
}
 
async function handleLeave(ctx) {
  const queue = player.nodes.get(ctx.guild.id);
  if (queue) queue.delete();
  return ctx.reply({ content: '👋 Покинул голосовой канал.' });
}
 
function buildHelpEmbed(prefix = '/') {
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📖 Команды бота')
    .addFields(
      { name: '🛡️ Заявки', value: `\`${prefix}apply\` — Опубликовать кнопку заявки\n\`${prefix}apphelp\` — Конфигурация (админ)` },
      {
        name: '🔨 Модерация _(нужно право «Управление участниками»)_',
        value: [
          `\`${prefix}ban @user [причина]\` — Забанить участника`,
          `\`${prefix}kick @user [причина]\` — Кикнуть участника`,
          `\`${prefix}mute @user [минуты] [причина]\` — Замьютить участника`,
          `\`${prefix}unmute @user\` — Снять мьют`,
          `\`${prefix}warn @user [причина]\` — Выдать предупреждение (авто-кик на 3-м)`,
          `\`${prefix}warnings @user\` — Просмотр предупреждений`,
          `\`${prefix}clearwarns @user\` — Сбросить предупреждения (админ)`,
        ].join('\n'),
      },
      {
        name: '🎵 Музыка',
        value: [
          `\`${prefix}play <Spotify URL или название>\` — Играть трек`,
          `\`${prefix}skip\` — Пропустить трек`,
          `\`${prefix}stop\` — Остановить и очистить очередь`,
          `\`${prefix}pause\` / \`${prefix}resume\` — Пауза/продолжить`,
          `\`${prefix}queue\` — Показать очередь`,
          `\`${prefix}np\` — Сейчас играет`,
          `\`${prefix}leave\` — Выйти из голосового канала`,
        ].join('\n'),
      },
    )
    .setFooter({ text: `Также работают префиксные команды с ${CONFIG.PREFIX}` })
    .setTimestamp();
}
 
// ══════════════════════════════════════════════════════
//  READY — register slash commands
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
 
  // Deploy slash commands globally
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
    console.log(`⚡ Registered ${slashCommands.length} slash commands globally`);
  } catch (e) {
    console.error('Failed to register slash commands:', e.message);
  }
});
 
// ══════════════════════════════════════════════════════
//  PREFIX COMMANDS  (!cmd)
// ══════════════════════════════════════════════════════
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(CONFIG.PREFIX)) return;
 
  const args = message.content.slice(CONFIG.PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();
 
  // Build a unified context from the message
  const makeCtx = async (extraOpts = {}) => {
    const base = {
      guild: message.guild,
      channel: message.channel,
      member: message.member,
      authorTag: message.author.tag,
      reply: (payload) => message.reply(payload),
      editReply: (payload) => message.reply(payload), // fallback for play
      ...extraOpts,
    };
    return base;
  };
 
  if (cmd === 'apply') {
    return handleApply(await makeCtx());
  }
 
  if (cmd === 'apphelp') {
    return handleAppHelp(await makeCtx());
  }
 
  if (cmd === 'ban') {
    const target = await resolveMemberFromArgs(message.guild, args);
    const reason = args.slice(1).join(' ') || undefined;
    return handleBan(await makeCtx({ target, reason }));
  }
 
  if (cmd === 'kick') {
    const target = await resolveMemberFromArgs(message.guild, args);
    const reason = args.slice(1).join(' ') || undefined;
    return handleKick(await makeCtx({ target, reason }));
  }
 
  if (cmd === 'mute') {
    const target = await resolveMemberFromArgs(message.guild, args);
    const minutes = parseInt(args[1]) || 10;
    const reason = args.slice(2).join(' ') || undefined;
    return handleMute(await makeCtx({ target, minutes, reason }));
  }
 
  if (cmd === 'unmute') {
    const target = await resolveMemberFromArgs(message.guild, args);
    return handleUnmute(await makeCtx({ target }));
  }
 
  if (cmd === 'warn') {
    const target = await resolveMemberFromArgs(message.guild, args);
    const reason = args.slice(1).join(' ') || undefined;
    return handleWarn(await makeCtx({ target, reason }));
  }
 
  if (cmd === 'warnings') {
    const target = await resolveMemberFromArgs(message.guild, args);
    return handleWarnings(await makeCtx({ target }));
  }
 
  if (cmd === 'clearwarns') {
    const target = await resolveMemberFromArgs(message.guild, args);
    return handleClearWarns(await makeCtx({ target }));
  }
 
  if (cmd === 'play') {
    const query = args.join(' ');
    // For prefix play, we send an initial message then edit it
    let sentMsg;
    const ctx = await makeCtx({
      query,
      reply: async (payload) => {
        sentMsg = await message.reply(payload);
        return sentMsg;
      },
      editReply: async (payload) => {
        if (sentMsg) return sentMsg.edit(payload);
        return message.reply(payload);
      },
    });
    return handlePlay(ctx);
  }
 
  if (cmd === 'skip')   return handleSkip(await makeCtx());
  if (cmd === 'stop')   return handleStop(await makeCtx());
  if (cmd === 'pause')  return handlePause(await makeCtx());
  if (cmd === 'resume') return handleResume(await makeCtx());
  if (cmd === 'queue')  return handleQueue(await makeCtx());
  if (cmd === 'np')     return handleNp(await makeCtx());
  if (cmd === 'leave')  return handleLeave(await makeCtx());
 
  if (cmd === 'help') {
    return message.channel.send({ embeds: [buildHelpEmbed(CONFIG.PREFIX)] });
  }
});
 
// ══════════════════════════════════════════════════════
//  INTERACTIONS  (slash commands + buttons + modals)
// ══════════════════════════════════════════════════════
client.on('interactionCreate', async (interaction) => {
 
  // ── SLASH COMMANDS ─────────────────────────────────
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;
 
    // Helper: build unified ctx from a slash interaction
    const makeSlashCtx = (extraOpts = {}) => ({
      guild: interaction.guild,
      channel: interaction.channel,
      member: interaction.member,
      authorTag: interaction.user.tag,
      reply: (payload) => interaction.reply(payload),
      editReply: (payload) => interaction.editReply(payload),
      ...extraOpts,
    });
 
    if (commandName === 'apply') return handleApply(makeSlashCtx());
    if (commandName === 'apphelp') return handleAppHelp(makeSlashCtx());
 
    if (commandName === 'ban') {
      await interaction.deferReply();
      const target = interaction.options.getMember('user');
      const reason = interaction.options.getString('reason') || undefined;
      return handleBan(makeSlashCtx({ target, reason, reply: (p) => interaction.editReply(p) }));
    }
 
    if (commandName === 'kick') {
      await interaction.deferReply();
      const target = interaction.options.getMember('user');
      const reason = interaction.options.getString('reason') || undefined;
      return handleKick(makeSlashCtx({ target, reason, reply: (p) => interaction.editReply(p) }));
    }
 
    if (commandName === 'mute') {
      await interaction.deferReply();
      const target = interaction.options.getMember('user');
      const minutes = interaction.options.getInteger('minutes') || 10;
      const reason = interaction.options.getString('reason') || undefined;
      return handleMute(makeSlashCtx({ target, minutes, reason, reply: (p) => interaction.editReply(p) }));
    }
 
    if (commandName === 'unmute') {
      await interaction.deferReply();
      const target = interaction.options.getMember('user');
      return handleUnmute(makeSlashCtx({ target, reply: (p) => interaction.editReply(p) }));
    }
 
    if (commandName === 'warn') {
      await interaction.deferReply();
      const target = interaction.options.getMember('user');
      const reason = interaction.options.getString('reason') || undefined;
      return handleWarn(makeSlashCtx({ target, reason, reply: (p) => interaction.editReply(p) }));
    }
 
    if (commandName === 'warnings') {
      const target = interaction.options.getMember('user');
      return handleWarnings(makeSlashCtx({ target }));
    }
 
    if (commandName === 'clearwarns') {
      const target = interaction.options.getMember('user');
      return handleClearWarns(makeSlashCtx({ target }));
    }
 
    if (commandName === 'play') {
      await interaction.deferReply();
      const query = interaction.options.getString('query');
      return handlePlay(makeSlashCtx({ query, reply: (p) => interaction.editReply(p) }));
    }
 
    if (commandName === 'skip')   return handleSkip(makeSlashCtx());
    if (commandName === 'stop')   return handleStop(makeSlashCtx());
    if (commandName === 'pause')  return handlePause(makeSlashCtx());
    if (commandName === 'resume') return handleResume(makeSlashCtx());
    if (commandName === 'queue')  return handleQueue(makeSlashCtx());
    if (commandName === 'np')     return handleNp(makeSlashCtx());
    if (commandName === 'leave')  return handleLeave(makeSlashCtx());
 
    if (commandName === 'help') {
      return interaction.reply({ embeds: [buildHelpEmbed('/')] });
    }
  }
 
  // ── BUTTON: open mod application modal ─────────────
  if (interaction.isButton() && interaction.customId === 'open_mod_application') {
    const modal = new ModalBuilder().setCustomId('mod_application_modal').setTitle('Заявка на модератора');
    const fields = [
      new TextInputBuilder().setCustomId('age').setLabel(`Ваш возраст (мин. ${CONFIG.MIN_AGE}+)`).setStyle(TextInputStyle.Short).setPlaceholder('например 18').setRequired(true).setMinLength(2).setMaxLength(3),
      new TextInputBuilder().setCustomId('timezone').setLabel('Ваш часовой пояс').setStyle(TextInputStyle.Short).setPlaceholder('например UTC+3, MSK').setRequired(true).setMaxLength(30),
      new TextInputBuilder().setCustomId('experience').setLabel('Опыт модерации').setStyle(TextInputStyle.Paragraph).setPlaceholder('Опишите опыт или напишите «Нет».').setRequired(true).setMaxLength(500),
      new TextInputBuilder().setCustomId('why').setLabel('Почему хочешь стать модератором?').setStyle(TextInputStyle.Paragraph).setPlaceholder('Расскажи о своей мотивации.').setRequired(true).setMaxLength(600),
      new TextInputBuilder().setCustomId('scenario').setLabel('Сценарий: юзер спамит оскорблениями?').setStyle(TextInputStyle.Paragraph).setPlaceholder('Опиши свои действия по шагам.').setRequired(true).setMaxLength(500),
    ];
    modal.addComponents(fields.map(f => new ActionRowBuilder().addComponents(f)));
    return interaction.showModal(modal);
  }
 
  // ── MODAL: mod application submit ──────────────────
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
      .setColor(0x57F287).setTitle('📋 Новая заявка на модератора')
      .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
      .addFields(
        { name: '👤 Заявитель', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
        { name: '🆔 ID пользователя', value: interaction.user.id, inline: true },
        { name: '🎂 Возраст', value: `${age}`, inline: true },
        { name: '🌍 Часовой пояс', value: timezone, inline: true },
        { name: '📅 Дата подачи', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
        { name: '🏆 Прошлый опыт', value: experience },
        { name: '💡 Мотивация', value: why },
        { name: '🚨 Ответ на сценарий', value: scenario },
      )
      .setFooter({ text: `Сервер: ${interaction.guild.name}` }).setTimestamp();
 
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
        await admin.send({ content: `📬 Новая заявка на модератора с сервера **${interaction.guild.name}**!`, embeds: [appEmbed], components: [reviewRow] });
        sent = true;
      } catch (e) { console.error(`DM error ${adminId}:`, e.message); }
    }
 
    return interaction.editReply({ content: sent
      ? '✅ **Заявка отправлена!** Команда рассмотрит её в ближайшее время. Спасибо!'
      : '⚠️ Заявка обработана, но доставка не удалась. Свяжись с администратором напрямую.' });
  }
 
  // ── BUTTON: approve / deny application ─────────────
  if (interaction.isButton()) {
    const [action, targetId] = interaction.customId.split('_');
    if (!['approve', 'deny'].includes(action) || !targetId) return;
 
    const isAdmin = CONFIG.ADMIN_IDS.includes(interaction.user.id) || interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);
    if (!isAdmin) return interaction.reply({ content: '🚫 Только для администраторов.', ephemeral: true });
 
    const verb = action === 'approve' ? 'Одобрено ✅' : 'Отклонено ❌';
    const color = action === 'approve' ? 0x57F287 : 0xED4245;
    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setColor(color).setFooter({ text: `${verb} — ${interaction.user.tag}` });
    await interaction.update({ embeds: [updatedEmbed], components: [] });
 
    try {
      const applicant = await client.users.fetch(targetId);
      await applicant.send({ embeds: [new EmbedBuilder().setColor(color)
        .setTitle(action === 'approve' ? '🎉 Заявка одобрена!' : '📋 Обновление заявки')
        .setDescription(action === 'approve'
          ? `Поздравляем! Ваша заявка на модератора на сервере **${interaction.guild?.name || 'сервер'}** была **одобрена**. Добро пожаловать в команду! 🛡️`
          : `Спасибо за заявку на сервере **${interaction.guild?.name || 'сервер'}**. К сожалению, на этот раз она не была принята — не стесняйся подать снова в будущем!`)
        .setTimestamp()] });
    } catch (e) { console.error('DM applicant error:', e.message); }
 
    return interaction.followUp({ content: `Заявка **${verb}** — заявитель уведомлён.`, ephemeral: true });
  }
});
 
client.login(process.env.BOT_TOKEN);
 