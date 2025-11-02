import express from "express";
import fetch from "node-fetch";
import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
import dotenv from "dotenv";
dotenv.config();

// === IDs ===
const OWNER_ROLE_ID = "1420450200308420759";
const SELLER_ROLE_ID = "1434272957407957124";
const MEMBER_ROLE_ID = "1420450360711057449";
const LOG_CHANNEL_ID = "1434278499539226776";
const GUILD_ID = "1420030272233017346";

// === Anti-sleep (Render) server ===
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("✅ Bot działa i nie śpi 😎"));
app.listen(PORT, () => console.log(`🌍 Keep-alive aktywny na porcie: ${PORT}`));

setInterval(() => {
  if (process.env.RENDER_EXTERNAL_URL) {
    fetch(`https://${process.env.RENDER_EXTERNAL_URL}`).catch(() => console.log("🔁 Ping nieudany"));
  }
}, 5 * 60 * 1000);

// === Discord Bot ===
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("ready", async () => {
  console.log(`✅ Zalogowano jako ${client.user.tag}`);

  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return console.log("❌ Bot nie widzi serwera — sprawdź GUILD_ID");

  await guild.commands.set([
    { name: "przejmij", description: "Przejmij ticket (owner lub seller)" }
  ]);

  console.log("✅ /przejmij załadowane!");
});

// === PRZEJMIJ SYSTEM ===
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "przejmij") return;

  const member = interaction.member;
  const channel = interaction.channel;
  const guild = interaction.guild;

  const isOwner = member.roles.cache.has(OWNER_ROLE_ID);
  const isSeller = member.roles.cache.has(SELLER_ROLE_ID);

  if (!isOwner && !isSeller) {
    return interaction.reply({ content: "❌ Nie masz uprawnień.", flags: 64 });
  }

  try {
    // Pobierz autora ticketa (pierwsza wiadomość w kanale z wzmianką)
    const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
    const firstMessage = messages?.last();
    let ticketCreator = null;
    if (firstMessage && firstMessage.mentions?.users.size > 0) {
      ticketCreator = firstMessage.mentions.users.first().id;
    }

    // ❌ Ukryj przed wszystkimi SELLERAMI
    await channel.permissionOverwrites.edit(SELLER_ROLE_ID, { ViewChannel: false });

    // ❌ Ukryj przed MEMBERS
    await channel.permissionOverwrites.edit(MEMBER_ROLE_ID, { ViewChannel: false });

    // ✅ Widoczność dla osoby przejmującej
    await channel.permissionOverwrites.edit(member.id, { ViewChannel: true });

    // ✅ Owner widzi zawsze
    await channel.permissionOverwrites.edit(OWNER_ROLE_ID, { ViewChannel: true });

    // ✅ Autor ticketa widzi
    if (ticketCreator && ticketCreator !== member.id) {
      await channel.permissionOverwrites.edit(ticketCreator, { ViewChannel: true });
    }

  } catch (err) {
    console.log("❌ Permission error:", err);
    return interaction.reply({ content: "❌ Bot nie ma uprawnień do zmian kanału!", flags: 64 });
  }

  // === Ticket embed ===
  const ticketEmbed = new EmbedBuilder()
    .setColor("#FFA500")
    .setTitle("🎫 Ticket przejęty")
    .setDescription(`<@${member.id}> przejął ticketa.`)
    .setTimestamp();

  // Wysyłamy embed + mention dla members
  await channel.send({ content: `<@&${MEMBER_ROLE_ID}>`, embeds: [ticketEmbed] });

  // === Log embed ===
  const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
  if (logChannel && logChannel.id !== channel.id) {
    const logEmbed = new EmbedBuilder()
      .setColor("#FFA500")
      .setTitle("📌 Ticket przejęty")
      .setDescription(`Użytkownik: <@${member.id}>\nTicket: ${channel.name}`)
      .setTimestamp();

    // Mention sellerów i ownera
    await logChannel.send({ content: `<@&${SELLER_ROLE_ID}> <@&${OWNER_ROLE_ID}>`, embeds: [logEmbed] });
  }

  return interaction.reply({ content: "✅ Ticket przejęty!", flags: 64 });
});

client.login(process.env.TOKEN);
