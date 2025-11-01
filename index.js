import express from "express";
import fetch from "node-fetch";
import { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder } from "discord.js";
import dotenv from "dotenv";
dotenv.config();

// WAZNE: ID ( NIE ZAPOMNIJ CENTRAL )
const OWNER_ROLE_ID = "1420450200308420759";
const SELLER_ROLE_ID = "1434272957407957124";
const MEMBER_ROLE_ID = "1420450360711057449";
const LOG_CHANNEL_ID = "1434278499539226776";

// --- Anti-sleep (Render) ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("✅ Bot działa i nie śpi 😎"));
app.listen(PORT, () => console.log(`🌍 Keep-alive aktywny na porcie: ${PORT}`));
setInterval(() => {
  if (process.env.RENDER_EXTERNAL_URL) fetch(`https://${process.env.RENDER_EXTERNAL_URL}`)
    .then(() => console.log('🔁 Ping wysłany'))
    .catch(() => console.log('🔁 Ping nieudany'));
}, 5 * 60 * 1000);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("ready", async () => {
  console.log(`✅ Zalogowano jako ${client.user.tag}`);

  const guild = client.guilds.cache.get("1420030272233017346"); // <<< TU WPISZ ID SERWERA

  if (!guild) {
    console.log("❌ Bot nie widzi serwera — sprawdź ID!");
    return;
  }

  await guild.commands.create({
    name: "przejmij",
    description: "Przejmij ticket (owner lub seller)"
  });

  console.log("✅ Slash command /przejmij zarejestrowana na serwerze!");
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "przejmij") return;

  const member = interaction.member;
  const channel = interaction.channel;
  const guild = interaction.guild;

  // ✅ Sprawdzenie ról
  const isOwner = member.roles.cache.has(OWNER_ROLE_ID);
  const isSeller = member.roles.cache.has(SELLER_ROLE_ID);

  if (!isOwner && !isSeller) {
    return interaction.reply({ content: "❌ Nie masz uprawnień.", ephemeral: true });
  }

  // ✅ Jeśli owner, to zabieramy widoczność reszcie sellerów
  if (isOwner) {
    try {
      await channel.permissionOverwrites.edit(SELLER_ROLE_ID, { ViewChannel: false });
    } catch (err) {
      console.log("❌ Brak uprawnień do zmiany permisji kanału!", err);
      return interaction.reply({ content: "❌ Bot nie ma uprawnień do zmiany permisji kanału.", ephemeral: true });
    }
  }

  // ✅ Wysyłamy embed na ticket (dla ownera i sellera taki sam)
  const embed = new EmbedBuilder()
    .setColor("#FFA500")
    .setTitle("🎫 Ticket przejęty")
    .setDescription(`<@${member.id}> przejął tego ticketa.`)
    .setTimestamp();

  await channel.send({ content: `<@&${MEMBER_ROLE_ID}>`, embeds: [embed] });

  // ✅ Log na kanał logów
  const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
  if (logChannel) {
    const logEmbed = new EmbedBuilder()
      .setColor("#FFA500")
      .setTitle("📌 Ticket przejęty")
      .setDescription(`Użytkownik: <@${member.id}>\nTicket: ${channel.name}`)
      .setTimestamp();

    await logChannel.send({ content: `<@&${SELLER_ROLE_ID}> <@&${OWNER_ROLE_ID}>`, embeds: [logEmbed] });
  }

  await interaction.reply({ content: "✅ Ticket przejęty pomyślnie!", ephemeral: true });
});

client.login(process.env.TOKEN);
