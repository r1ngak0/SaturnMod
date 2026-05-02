

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
    return message.reply({ embeds: [embed], components: [row] });
  }
 
  if (cmd === 'apphelp') {
    if (!requireAdmin(message)) return message.reply('🚫 Только для администраторов.');
    return message.reply(
      `**Конфигурация бота:**\n` +
      `• Мин. возраст: **${CONFIG.MIN_AGE}+**\n` +
      `• Канал заявок: <#${CONFIG.APPLICATIONS_CHANNEL_ID}>\n` +
      `• Администраторы: ${CONFIG.ADMIN_IDS.map(id => `<@${id}>`).join(', ')}`
    );
  }
 
  // ──────────────────────────────────────
  //  MODERATION
  // ──────────────────────────────────────
  if (cmd === 'ban') {
    if (!requireMod(message)) return message.reply('🚫 Нужно право «Управление участниками».');
    const target = await resolveMember(message, args);
    if (!target) return message.reply('❌ Пользователь не найден.');
    const reason = args.slice(1).join(' ') || 'Причина не указана';
    try {
      await target.ban({ reason, deleteMessageSeconds: 86400 });
      return message.channel.send({ embeds: [modEmbed('🔨 Участник забанен', `**${target.user.tag}** был забанен.\n**Причина:** ${reason}`, 0xED4245)] });
    } catch (e) { return message.reply(`❌ Не удалось забанить: ${e.message}`); }
  }
 
  if (cmd === 'kick') {
    if (!requireMod(message)) return message.reply('🚫 Нужно право «Управление участниками».');
    const target = await resolveMember(message, args);
    if (!target) return message.reply('❌ Пользователь не найден.');
    const reason = args.slice(1).join(' ') || 'Причина не указана';
    try {
      await target.kick(reason);
      return message.channel.send({ embeds: [modEmbed('👢 Участник кикнут', `**${target.user.tag}** был кикнут.\n**Причина:** ${reason}`, 0xFEE75C)] });
    } catch (e) { return message.reply(`❌ Не удалось кикнуть: ${e.message}`); }
  }
 
  if (cmd === 'mute') {
    if (!requireMod(message)) return message.reply('🚫 Нужно право «Управление участниками».');
    const target = await resolveMember(message, args);
    if (!target) return message.reply('❌ Пользователь не найден.');
    const minutes = parseInt(args[1]) || 10;
    const reason = args.slice(2).join(' ') || 'Причина не указана';
    const ms = minutes * 60 * 1000;
    if (ms > 28 * 24 * 60 * 60 * 1000) return message.reply('❌ Мьют не может превышать 28 дней.');
    try {
      await target.timeout(ms, reason);
      return message.channel.send({ embeds: [modEmbed('🔇 Участник замьючен', `**${target.user.tag}** замьючен на **${minutes} мин**.\n**Причина:** ${reason}`, 0xFEE75C)] });
    } catch (e) { return message.reply(`❌ Не удалось замьютить: ${e.message}`); }
  }
 
  if (cmd === 'unmute') {
    if (!requireMod(message)) return message.reply('🚫 Нужно право «Управление участниками».');
    const target = await resolveMember(message, args);
    if (!target) return message.reply('❌ Пользователь не найден.');
    try {
      await target.timeout(null);
      return message.channel.send({ embeds: [modEmbed('🔊 Мьют снят', `**${target.user.tag}** разамьючен.`, 0x57F287)] });
    } catch (e) { return message.reply(`❌ Не удалось снять мьют: ${e.message}`); }
  }
 
  if (cmd === 'warn') {
    if (!requireMod(message)) return message.reply('🚫 Нужно право «Управление участниками».');
    const target = await resolveMember(message, args);
    if (!target) return message.reply('❌ Пользователь не найден.');
    const reason = args.slice(1).join(' ') || 'Причина не указана';
    const userWarns = getWarnings(message.guild.id, target.id);
    userWarns.push({ reason, date: new Date().toISOString(), by: message.author.tag });
    const count = userWarns.length;
 
    await message.channel.send({ embeds: [modEmbed(
      `⚠️ Member Warned (${count}/${CONFIG.WARN_KICK_THRESHOLD})`,
      `**${target.user.tag}** получил предупреждение.\n**Причина:** ${reason}`, 0xFEE75C
    )]});
 
    try { await target.send({ embeds: [modEmbed('⚠️ Вы получили предупреждение', `**Сервер:** ${message.guild.name}\n**Причина:** ${reason}\n**Кол-во предупреждений:** ${count}`, 0xFEE75C)] }); } catch {}
 
    if (count >= CONFIG.WARN_KICK_THRESHOLD) {
      try {
        await target.kick(`Авто-кик: достигнуто ${CONFIG.WARN_KICK_THRESHOLD} предупреждений`);
        await message.channel.send({ embeds: [modEmbed('👢 Авто-кик', `**${target.user.tag}** был авто-кикнут после **${CONFIG.WARN_KICK_THRESHOLD} предупреждений**.`, 0xED4245)] });
        warnings.get(message.guild.id).delete(target.id);
      } catch (e) { await message.reply(`⚠️ Не удалось авто-кикнуть: ${e.message}`); }
    }
    return;
  }
 
  if (cmd === 'warnings') {
    if (!requireMod(message)) return message.reply('🚫 Нужно право «Управление участниками».');
    const target = await resolveMember(message, args);
    if (!target) return message.reply('❌ Пользователь не найден.');
    const userWarns = getWarnings(message.guild.id, target.id);
    if (!userWarns.length) return message.reply(`✅ У **${target.user.tag}** нет предупреждений.`);
    const list = userWarns.map((w, i) => `**${i + 1}.** ${w.reason} _(by ${w.by} — ${w.date.slice(0, 10)})_`).join('\n');
    return message.channel.send({ embeds: [modEmbed(`⚠️ Предупреждения ${target.user.tag}`, list, 0xFEE75C)] });
  }
 
  if (cmd === 'clearwarns') {
    if (!requireAdmin(message)) return message.reply('🚫 Только для администраторов.');
    const target = await resolveMember(message, args);
    if (!target) return message.reply('❌ Пользователь не найден.');
    if (warnings.has(message.guild.id)) warnings.get(message.guild.id).delete(target.id);
    return message.reply({ embeds: [modEmbed('✅ Предупреждения сброшены', `Все предупреждения для **${target.user.tag}** сброшены.`, 0x57F287)] });
  }
 
  // ──────────────────────────────────────
  //  MUSIC
  // ──────────────────────────────────────
  if (cmd === 'play') {
    if (!args.length) return message.reply('❌ Использование: `!play <Spotify URL или название песни>`');
 
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.reply('❌ Сначала зайди в голосовой канал!');
 
    let query = args.join(' ');
 
    // Resolve Spotify URL → track name
    const spotifyMatch = query.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/);
    if (spotifyMatch) {
      if (!CONFIG.SPOTIFY_CLIENT_ID) return message.reply('❌ Данные Spotify не настроены. Используй название песни.');
      try {
        const trackData = await spotifyApi.getTrack(spotifyMatch[1]);
        const t = trackData.body;
        query = `${t.name} ${t.artists[0].name}`;
        await message.reply({ embeds: [modEmbed('🎧 Трек Spotify', `Найдено **${t.name}** — ${t.artists.map(a => a.name).join(', ')}\nПоиск...`, 0x1DB954)] });
      } catch (e) { return message.reply(`❌ Ошибка Spotify: ${e.message}`); }
    }
 
    const msg = await message.reply('🔍 Ищу...');
 
    try {
      const { track } = await player.play(voiceChannel, query, {
        nodeOptions: {
          metadata: { channel: message.channel },
          selfDeaf: true,
        },
      });
 
      await msg.edit({ content: '', embeds: [
        modEmbed('➕ Добавлено в очередь', `**[${track.title}](${track.url})**\nДлительность: ${track.duration}`, 0x5865F2)
      ]});
    } catch (e) {
      console.error('Play error:', e.message);
      await msg.edit(`❌ Не удалось воспроизвести: ${e.message}`);
    }
    return;
  }
 
  if (cmd === 'skip') {
    const queue = player.nodes.get(message.guild.id);
    if (!queue || !queue.isPlaying()) return message.reply('❌ Ничего не играет.');
    queue.node.skip();
    return message.reply({ embeds: [modEmbed('⏭️ Пропущено', 'Текущий трек пропущен.', 0x5865F2)] });
  }
 
  if (cmd === 'stop') {
    const queue = player.nodes.get(message.guild.id);
    if (!queue) return message.reply('❌ Ничего не играет.');
    queue.delete();
    return message.reply({ embeds: [modEmbed('⏹️ Остановлено', 'Музыка остановлена, очередь очищена.', 0xED4245)] });
  }
 
  if (cmd === 'pause') {
    const queue = player.nodes.get(message.guild.id);
    if (!queue || !queue.isPlaying()) return message.reply('❌ Ничего не играет.');
    queue.node.pause();
    return message.reply({ embeds: [modEmbed('⏸️ Пауза', 'Используй `!resume` для продолжения.', 0xFEE75C)] });
  }
 
  if (cmd === 'resume') {
    const queue = player.nodes.get(message.guild.id);
    if (!queue) return message.reply('❌ Ничего не играет.');
    queue.node.resume();
    return message.reply({ embeds: [modEmbed('▶️ Воспроизведение возобновлено', 'Музыка возобновлена.', 0x57F287)] });
  }
 
  if (cmd === 'queue') {
    const queue = player.nodes.get(message.guild.id);
    if (!queue || (!queue.isPlaying() && !queue.tracks.size)) return message.reply('📭 Очередь пуста.');
    const current = queue.currentTrack;
    const tracks = queue.tracks.toArray().slice(0, 10);
    const nowPlaying = current ? `▶️ **Now:** [${current.title}](${current.url})\n\n` : '';
    const upcoming = tracks.length
      ? tracks.map((t, i) => `**${i + 1}.** [${t.title}](${t.url}) — ${t.duration}`).join('\n')
      : '_Следующих треков нет_';
    const embed = modEmbed('🎵 Очередь', nowPlaying + upcoming, 0x5865F2);
    if (queue.tracks.size > 10) embed.setFooter({ text: `+ ещё ${queue.tracks.size - 10}` });
    return message.channel.send({ embeds: [embed] });
  }
 
  if (cmd === 'np') {
    const queue = player.nodes.get(message.guild.id);
    if (!queue || !queue.currentTrack) return message.reply('❌ Ничего не играет.');
    const t = queue.currentTrack;
    return message.reply({ embeds: [modEmbed('🎵 Сейчас играет', `**[${t.title}](${t.url})**\nДлительность: ${t.duration}`, 0x1DB954)] });
  }
 
  if (cmd === 'leave') {
    const queue = player.nodes.get(message.guild.id);
    if (queue) queue.delete();
    return message.reply('👋 Покинул голосовой канал.');
  }
 
  if (cmd === 'help') {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📖 Команды бота')
      .addFields(
        { name: '🛡️ Заявки', value: '`!apply` — Опубликовать кнопку заявки\n`!apphelp` — Конфигурация (админ)' },
        {
          name: '🔨 Модерация _(нужно право «Управление участниками»)_',
          value: [
            '`!ban @user [причина]` — Забанить участника',
            '`!kick @user [причина]` — Кикнуть участника',
            '`!mute @user [минуты] [причина]` — Замьютить участника',
            '`!unmute @user` — Снять мьют',
            '`!warn @user [причина]` — Выдать предупреждение (авто-кик на 3-м)',
            '`!warnings @user` — Просмотр предупреждений',
            '`!clearwarns @user` — Сбросить предупреждения (админ)',
          ].join('\n'),
        },
        {
          name: '🎵 Музыка',
          value: [
            '`!play <Spotify URL или название>` — Играть трек',
            '`!skip` — Пропустить трек',
            '`!stop` — Остановить и очистить очередь',
            '`!pause` / `!resume` — Пауза/продолжить',
            '`!queue` — Показать очередь',
            '`!np` — Сейчас играет',
            '`!leave` — Выйти из голосового канала',
          ].join('\n'),
        },
      )
      .setFooter({ text: `Префикс: ${CONFIG.PREFIX}` })
      .setTimestamp();
    return message.channel.send({ embeds: [embed] });
  }
});
 
// ══════════════════════════════════════════════════════
//  INTERACTIONS
// ══════════════════════════════════════════════════════
client.on('interactionCreate', async (interaction) => {
 
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
 