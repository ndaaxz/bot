import pkg from "@whiskeysockets/baileys"; // Impor modul sebagai default
import axios from "axios";
const { proto, getContentType } = pkg; // Destrukturisasi objek yang diperlukan

export async function fetchJson(url) {
    try {
        let res = await axios.get(url)
        let ress = res.data
        return ress  
    } catch (error) {
        console.log("fetch error : ", error)
    }
}
export function smsg(ptz, m, store) {
  if (!m) return m;
  let M = proto.WebMessageInfo;
  if (m.key) {
    m.id = m.key.id;
    m.isBaileys = m.id.startsWith('BAE5') && m.id.length === 16;
    m.chat = m.key.remoteJid;
    m.fromMe = m.key.fromMe;
    m.isGroup = m.chat.endsWith('@g.us');
    m.sender = ptz.decodeJid(m.fromMe && ptz.user.id || m.participant || m.key.participant || m.chat || '');
    if (m.isGroup) m.participant = ptz.decodeJid(m.key.participant) || '';
  }
  if (m.message) {
    m.mtype = getContentType(m.message);
    m.msg = (m.mtype == 'viewOnceMessage' ? m.message[m.mtype].message[getContentType(m.message[m.mtype].message)] : m.message[m.mtype]);
    m.body = m.message.conversation || m.msg.caption || m.msg.text || (m.mtype == 'listResponseMessage') && m.msg.singleSelectReply.selectedRowId || (m.mtype == 'buttonsResponseMessage') && m.msg.selectedButtonId || (m.mtype == 'viewOnceMessage') && m.msg.caption || m.text;
    let quoted = m.quoted = m.msg.contextInfo ? m.msg.contextInfo.quotedMessage : null;
    m.mentionedJid = m.msg.contextInfo ? m.msg.contextInfo.mentionedJid : [];
    if (m.quoted) {
      let type = getContentType(quoted);
      m.quoted = m.quoted[type];
      if (['productMessage'].includes(type)) {
        type = getContentType(m.quoted);
        m.quoted = m.quoted[type];
      }
      if (typeof m.quoted === 'string') m.quoted = {
        text: m.quoted
      };
      m.quoted.mtype = type;
      m.quoted.id = m.msg.contextInfo.stanzaId;
      m.quoted.chat = m.msg.contextInfo.remoteJid || m.chat;
      m.quoted.isBaileys = m.quoted.id ? m.quoted.id.startsWith('BAE5') && m.quoted.id.length === 16 : false;
      m.quoted.sender = ptz.decodeJid(m.msg.contextInfo.participant);
      m.quoted.fromMe = m.quoted.sender === ptz.decodeJid(ptz.user.id);
      m.quoted.text = m.quoted.text || m.quoted.caption || m.quoted.conversation || m.quoted.contentText || m.quoted.selectedDisplayText || m.quoted.title || '';
      m.quoted.mentionedJid = m.msg.contextInfo ? m.msg.contextInfo.mentionedJid : [];
      m.getQuotedObj = m.getQuotedMessage = async () => {
        if (!m.quoted.id) return false;
        let q = await store.loadMessage(m.chat, m.quoted.id, ptz);
        return smsg(ptz, q, store);
      };
      let vM = m.quoted.fakeObj = M.fromObject({
        key: {
          remoteJid: m.quoted.chat,
          fromMe: m.quoted.fromMe,
          id: m.quoted.id
        },
        message: quoted,
        ...(m.isGroup ? { participant: m.quoted.sender } : {})
      });
      m.quoted.delete = () => ptz.sendMessage(m.quoted.chat, { delete: vM.key });
      m.quoted.copyNForward = (jid, forceForward = false, options = {}) => ptz.copyNForward(jid, vM, forceForward, options);
      m.quoted.download = () => ptz.downloadMediaMessage(m.quoted);
    }
  }
  if (m.msg.url) m.download = () => ptz.downloadMediaMessage(m.msg);
  m.text = m.msg.text || m.msg.caption || m.message.conversation || m.msg.contentText || m.msg.selectedDisplayText || m.msg.title || '';
  m.reply = (text, chatId = m.chat, options = {}) => Buffer.isBuffer(text) ? ptz.sendMedia(chatId, text, 'file', '', m, { ...options }) : ptz.sendText(chatId, text, m, { ...options });
  m.copy = () => smsg(ptz, M.fromObject(M.toObject(m)));
  m.copyNForward = (jid = m.chat, forceForward = false, options = {}) => ptz.copyNForward(jid, m, forceForward, options);

  return m;
}