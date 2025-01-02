import pkg from "@whiskeysockets/baileys";
const { default: makeWASocket, DisconnectReason, makeInMemoryStore, jidDecode, proto, getContentType, useMultiFileAuthState, downloadContentFromMessage } = pkg;
import pino from "pino";
import { Boom } from "@hapi/boom";
import fs from "fs";
import axios from "axios"
import readline from "readline";
import PhoneNumber from "awesome-phonenumber";
import { smsg } from "./lib/func.js";
import { openDb, initDb, getUser, updateUser } from "./lib/database.js";
import { renderBoard, checkWinner, isBoardFull, startGame, placeSymbol } from "./lib/ttt.js";

//Setting Owner Disini
const OWNERS = ["6285640575421", "0"];
// Variabel untuk menyimpan status permainan dll
const ticTacToeGames = new Map();
const userAgreements = new Map();


const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });

const question = (text) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(text, resolve));
};

// Prefix untuk bot
const PREFIX = "!"; // Anda bisa mengubah prefix sesuai kebutuhan

// Inisialisasi database
initDb();

async function startBotz() {
  const { state, saveCreds } = await useMultiFileAuthState("session");
  const ptz = makeWASocket({
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    auth: state,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 0,
    keepAliveIntervalMs: 10000,
    emitOwnEvents: true,
    fireInitQueries: true,
    generateHighQualityLinkPreview: true,
    syncFullHistory: true,
    markOnlineOnConnect: true,
    browser: ["Ubuntu", "Chrome", "20.0.04"],
  });

  if (!ptz.authState.creds.registered) {
    const phoneNumber = await question('Enter Phone Number :\n');
    let code = await ptz.requestPairingCode(phoneNumber);
    code = code?.match(/.{1,4}/g)?.join("-") || code;
    console.log(`Pairing Code :`, code);
  }

  store.bind(ptz.ev);

  // Event messages.upsert
  ptz.ev.on('messages.upsert', async (chatUpdate) => {
    try {
      const message = chatUpdate.messages[0];
      if (!message.message) return; // Jika tidak ada pesan, abaikan

      // Proses pesan menggunakan fungsi smsg
      const m = smsg(ptz, message, store);

      // Cek apakah pesan dimulai dengan prefix
      if (!m.body?.startsWith(PREFIX)) return; // Abaikan jika tidak ada prefix

      // Hilangkan prefix dari pesan
      const text = m.body.slice(PREFIX.length).trim();

      // Pisahkan command dan argumen
      const [command, ...args] = text.split(" ");

      // Fungsi untuk mengecek apakah pengguna adalah owner
    const isOwner = OWNERS.includes(m.sender.split('@')[0]);
      // Ambil data pengguna
      const user = await getUser(m.sender);
      // Logika command
      switch (command.toLowerCase()) {
        case 'tiktok': {
          const url = args[0];
        if (!url || !url.includes("tiktok.com")) {
          await ptz.sendText(m.chat, "Masukkan URL video TikTok yang valid. Contoh: !tiktok https://www.tiktok.com/@username/video/123456789");
          return;
        }

        // Mengambil data video dari API tikwm.com
        try {
          user.limit -= 1; // Kurangi limit
          await updateUser(m.sender, user)
          m.reply("limit anda di kurangi 1")
          const apiUrl = `https://tikwm.com/api/?url=${encodeURIComponent(url)}`;
          const response = await axios.get(apiUrl);

          if (response.data && response.data.data) {
            const videoUrl = response.data.data.play; // URL video
            const title = response.data.data.title; // Judul video

            // Download video
            const videoBuffer = await axios.get(videoUrl, { responseType: 'arraybuffer' });

            // Kirim video beserta judul
            await ptz.sendMessage(m.chat, {
              video: videoBuffer.data,
              caption: `🎥 *Judul:* ${title}`,
            });
          } else {
            await ptz.sendText(m.chat, "Gagal mengambil data video TikTok.");
          }
        } catch (err) {
          console.error("Error downloading TikTok video:", err);
          await ptz.sendText(m.chat, "Terjadi kesalahan saat memproses video TikTok.");
        }
        }
        break
        case "eval":
        try {
          if(!isOwner) return m.reply('lu bukan owner')
          // Jalankan kode JavaScript
          const result = eval(args.join(" "));
          await ptz.sendText(m.chat, result);
        } catch (err) {
          await ptz.sendText(m.chat, `Error saat menjalankan eval:\n${err.message}`);
        }
        break;
        case "restart":
          if(!isOwner) return ptz.sendText(m.chat, 'Kamu Bukan Owner!')
          await ptz.sendText(m.chat, "Bot sedang merestart...");
          process.exit(0); // Restart bot
          break;
        case "tictactoe":
  const opponent = m.mentionedJid[0]; // Mention lawan
  if (!opponent) {
    await ptz.sendText(m.chat, "Tag lawan untuk memulai permainan. Contoh: !tictactoe @6281234567890");
    return;
  }
  if (opponent === m.sender) {
    await ptz.sendText(m.chat, "Anda tidak bisa bermain melawan diri sendiri.");
    return;
  }

  // Mulai permainan
  const newGame = startGame(m.chat, [m.sender, opponent]); // Ganti nama variabel
  ticTacToeGames.set(m.chat, newGame);

  // Kirim papan awal
  await ptz.sendText(m.chat, `Permainan Tic Tac Toe dimulai!\n\n${renderBoard(newGame.board)}\nGiliran: @${m.sender.split('@')[0]}\n\nGunakan command !place <angka> untuk menempatkan simbol.`);
  break;
        
              case "place":
                const game = ticTacToeGames.get(m.chat);
                if (!game) {
                  await ptz.sendText(m.chat, "Tidak ada permainan Tic Tac Toe yang aktif.");
                  return;
                }
                if (game.players[0] !== m.sender && game.players[1] !== m.sender) {
                  await ptz.sendText(m.chat, "Anda bukan peserta dalam permainan ini.");
                  return;
                }
                if (game.turn !== m.sender) {
                  await ptz.sendText(m.chat, "Sekarang bukan giliran Anda.");
                  return;
                }
        
                const position = parseInt(args[0]);
                if (isNaN(position) || position < 1 || position > 9) {
                  await ptz.sendText(m.chat, "Masukkan angka yang valid (1-9).");
                  return;
                }
        
                // Tentukan simbol pemain
                const symbol = game.players[0] === m.sender ? "X" : "O";
                const result = placeSymbol(game, position, symbol);
        
                if (!result.success) {
                  await ptz.sendText(m.chat, result.message);
                  return;
                }
        
                // Cek apakah ada pemenang
                const winner = checkWinner(game.board);
                if (winner) {
                  await ptz.sendText(m.chat, `${renderBoard(game.board)}\n@${m.sender.split('@')[0]} menang! 🎉`);
                  ticTacToeGames.delete(m.chat);
                  return;
                }
        
                // Cek apakah seri
                if (isBoardFull(game.board)) {
                  await ptz.sendText(m.chat, `${renderBoard(game.board)}\nPermainan seri! 🤝`);
                  ticTacToeGames.delete(m.chat);
                  return;
                }
        
                // Ganti giliran
                game.turn = game.players[0] === m.sender ? game.players[1] : game.players[0];
        
                // Kirim papan yang diperbarui
                await ptz.sendText(m.chat, `${renderBoard(game.board)}\nGiliran: @${game.turn.split('@')[0]}`);
                break;
        case "profile":
                  await ptz.sendText(m.chat, `Profil Anda:\nExp: ${user.exp}\nMoney: ${user.money}\nLevel: ${user.level}\nLimit: ${user.limit}`);
                  break;
                  case "work":
                    if (user.limit <= 0) {
                      await ptz.sendText(m.chat, "Limit Anda sudah habis. Anda tidak bisa menggunakan fitur ini lagi hari ini.");
                      return;
                    }
            
                    const earnings = Math.floor(Math.random() * 100) + 50; // Random earnings
                    user.money += earnings;
                    user.limit -= 1; // Kurangi limit
                    await updateUser(m.sender, user);
                    await ptz.sendText(m.chat, `Anda bekerja dan mendapatkan ${earnings} uang! Limit tersisa: ${user.limit}`);
                    break;
          case "daily":
            if (user.limit <= 0) {
              await ptz.sendText(m.chat, "Limit Anda sudah habis. Anda tidak bisa menggunakan fitur ini lagi hari ini.");
              return;
            }
    
            const reward = 200; // Daily reward
            user.money += reward;
            user.limit -= 1; // Kurangi limit
            await updateUser(m.sender, user);
            await ptz.sendText(m.chat, `Anda mengklaim hadiah harian sebesar ${reward} uang! Limit tersisa: ${user.limit}`);
            break;
          case "help":
            case "menu":
              // Jika user belum menyetujui TOS, tampilkan TOS
              if (!userAgreements.get(m.sender)) {
                const tosMessage = `
      📜 *Terms of Service (TOS)* 📜
      
      1. Anda setuju untuk menggunakan bot ini dengan bijak.
      2. Anda tidak akan menggunakan bot ini untuk tujuan yang melanggar hukum.
      3. Bot ini dapat menyimpan data Anda untuk keperluan fungsionalitas.
      
      Ketik *Y* untuk menyetujui TOS dan melanjutkan.
      Ketik *N* untuk menolak TOS.
                `;
                await ptz.sendText(m.chat, tosMessage);
                return;
              }       
              // Jika user sudah menyetujui TOS, tampilkan menu
              const menuMessage = `
      🤖 *Daftar Command Bot* 🤖
      
      📌 *General Commands:*
      !menu - Menampilkan daftar command
      !profile - Menampilkan profil pengguna
      !work - Bekerja untuk mendapatkan uang
      !daily - Klaim hadiah harian
      
      🎮 *Game Commands:*
      !tictactoe @mention - Mulai permainan Tic Tac Toe dengan teman
      !place <angka> - Menempatkan simbol di papan Tic Tac Toe
      
      📂 *Other Commands:*
      !help - Menampilkan bantuan
      
      Gunakan command dengan bijak! 😊
              `;
              await ptz.sendText(m.chat, menuMessage);
              break;
            case "y":
      case "n":
        if (!userAgreements.get(m.sender)) {
          if (command.toLowerCase() === "y") {
            userAgreements.set(m.sender, true); // Setujui TOS
            await ptz.sendText(m.chat, "Terima kasih telah menyetujui TOS. Ketik !menu untuk melihat daftar command.");
          } else {
            await ptz.sendText(m.chat, "Anda tidak menyetujui TOS. Bot tidak dapat digunakan.");
          }
        } else {
          await ptz.sendText(m.chat, "Anda sudah menyetujui TOS sebelumnya.");
        }
        break;
        default:
          await ptz.sendText(m.chat, "Unknown command. Type !help for a list of commands.");
      }
    } catch (err) {
      console.error("Error processing message:", err);
    }
  });

  // Setting
  ptz.decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
      let decode = jidDecode(jid) || {};
      return decode.user && decode.server && decode.user + '@' + decode.server || jid;
    } else return jid;
  };

  ptz.getName = (jid, withoutContact = false) => {
    let id = ptz.decodeJid(jid);
    withoutContact = ptz.withoutContact || withoutContact;
    let v;
    if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
      v = store.contacts[id] || {};
      if (!(v.name || v.subject)) v = ptz.groupMetadata(id) || {};
      resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'));
    });
    else v = id === '0@s.whatsapp.net' ? {
      id,
      name: 'WhatsApp'
    } : id === ptz.decodeJid(ptz.user.id) ?
      ptz.user :
      (store.contacts[id] || {});
    return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international');
  };

  ptz.public = true;

  ptz.serializeM = (m) => smsg(ptz, m, store);
  ptz.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
      if (reason === DisconnectReason.badSession || reason === DisconnectReason.connectionClosed || reason === DisconnectReason.connectionLost || reason === DisconnectReason.connectionReplaced || reason === DisconnectReason.restartRequired || reason === DisconnectReason.timedOut) {
        startBotz();
      } else if (reason === DisconnectReason.loggedOut) {
      } else {
        ptz.end(`Unknown DisconnectReason: ${reason}|${connection}`);
      }
    } else if (connection === 'open') {
      console.log('[Connected] ' + JSON.stringify(ptz.user.id, null, 2));
    }
  });

  ptz.ev.on('creds.update', saveCreds);

  ptz.sendText = (jid, text, quoted = '', options) => ptz.sendMessage(jid, { text: text, ...options }, { quoted });

  ptz.downloadMediaMessage = async (message) => {
    let mime = (message.msg || message).mimetype || '';
    let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0];
    const stream = await downloadContentFromMessage(message, messageType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
  };

  return ptz;
}

startBotz();
