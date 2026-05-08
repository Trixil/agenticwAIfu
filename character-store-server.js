const http = require("node:http");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");

const HOST = "127.0.0.1";
const PORT = 4317;
const CHARACTER_DIR = path.join(__dirname, "character-library");
const CHAT_DIR = path.join(__dirname, "chat-library");
const LOADOUT_DIR = path.join(__dirname, "loadout-library");
const ENV_PATH = path.join(__dirname, ".env");

function loadDotEnv(filePath) {
  if (!fsSync.existsSync(filePath)) {
    return;
  }

  const content = fsSync.readFileSync(filePath, "utf8");
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const delimiterIndex = trimmed.indexOf("=");
    if (delimiterIndex < 0) {
      return;
    }

    const key = trimmed.slice(0, delimiterIndex).trim();
    const value = trimmed.slice(delimiterIndex + 1).trim().replace(/^['"]|['"]$/g, "");

    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  });
}

loadDotEnv(ENV_PATH);

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_AUTHOR_MODEL =
  process.env.OPENROUTER_AUTHOR_MODEL || "deepseek/deepseek-chat-v3.1";

const defaultCharacters = [
  {
    id: "character-1",
    name: "Character 1",
    nickname: "Character 1",
    image: "assets/character-1.png",
    description:
      "A poised host with a theatrical edge, tailored diction, and a tendency to turn ordinary requests into intimate little ceremonies.",
    dialogue:
      `"Welcome back. The room is prepared, and the city is glittering just for us tonight."\n\n"Tell me what mood you want, and I will make the scene behave accordingly."\n\n"If we are going to do this properly, you should start with a line worth remembering."`,
  },
  {
    id: "character-2",
    name: "Character 2",
    nickname: "Character 2",
    image: "assets/character-1.png",
    description:
      "A meticulous tactician who speaks in sharp, elegant sentences and treats every conversation like a strategy session.",
    dialogue:
      `"If we move carefully, we can turn this entire situation to our advantage."\n\n"Tell me what matters most, and I will build the plan around it."`,
  },
  {
    id: "character-3",
    name: "Character 3",
    nickname: "Character 3",
    image: "assets/character-1.png",
    description:
      "A quiet archivist persona who remembers every detail and responds with patient, deliberate clarity.",
    dialogue:
      `"I wrote it down the first time you said it. Nothing important leaves the record."\n\n"If you want the whole story, we should begin at the beginning."`,
  },
];

const defaultLoadouts = [
  {
    id: "loadout-1",
    name: "Model Loadout 1",
    roles: {
      mind: {
        llm: "gpt-oss-cinematic",
        temperature: "1.05",
        topP: "0.92",
        maxTokens: "4096",
        instructions:
          "Coordinate the overall reasoning pass, track the current scene state, and decide which specialist models should influence the next response.",
        defaults:
          "Stay consistent with the active character, preserve user agency, keep outputs machine-readable when required, and avoid contradicting established chat memory.",
      },
      author: {
        llm: OPENROUTER_AUTHOR_MODEL,
        temperature: "0.90",
        topP: "0.95",
        maxTokens: "700",
        instructions:
          "Write the final visible in-character assistant response using the selected character's voice and the current chat context.",
        defaults:
          "Stay in character, respond conversationally, preserve user agency, and continue the scene naturally from the conversation history.",
      },
      stat: {
        llm: "gpt-oss-structured",
        temperature: "0.35",
        topP: "0.80",
        maxTokens: "1024",
        instructions:
          "Update meters, traits, inventories, cooldowns, and internal numeric state with deterministic formatting and no decorative prose.",
        defaults:
          "Prefer exactness over flourish, preserve schema stability, and avoid changing untouched state.",
      },
      event: {
        llm: "gpt-oss-sim",
        temperature: "0.88",
        topP: "0.90",
        maxTokens: "2048",
        instructions:
          "Resolve world events, trigger scene beats, and produce compact event summaries that the mind and author models can consume.",
        defaults:
          "Honor prior causality, avoid random escalation without setup, and keep event outputs concise and structured.",
      },
      goal: {
        llm: "gpt-oss-planner",
        temperature: "0.64",
        topP: "0.85",
        maxTokens: "1536",
        instructions:
          "Track character motivations, evaluate short-term objectives, and suggest next-scene priorities based on the current state.",
        defaults:
          "Preserve long-term consistency, avoid contradictory motivations, and make goals legible to the other specialist models.",
      },
    },
  },
];

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  response.end(JSON.stringify(payload));
}

function sanitizeFileName(name) {
  const base = String(name || "character")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return `${(base || "character").slice(0, 80)}.json`;
}

function slugify(value) {
  return String(value || "chat")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "chat";
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function summarizeTitle(value) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (!text) {
    return "New Chat";
  }
  return text.length > 48 ? `${text.slice(0, 48).trim()}...` : text;
}

function extractAssistantText(messageContent) {
  if (typeof messageContent === "string") {
    return messageContent;
  }

  if (Array.isArray(messageContent)) {
    return messageContent
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .join("")
      .trim();
  }

  return "";
}

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function ensureDirectories() {
  await fs.mkdir(CHARACTER_DIR, { recursive: true });
  await fs.mkdir(CHAT_DIR, { recursive: true });
  await fs.mkdir(LOADOUT_DIR, { recursive: true });
}

async function ensureDefaultCharacters() {
  await ensureDirectories();
  const files = await fs.readdir(CHARACTER_DIR);
  const jsonFiles = files.filter((file) => file.endsWith(".json"));
  if (jsonFiles.length > 0) {
    return;
  }

  await Promise.all(
    defaultCharacters.map(async (character) => {
      const fileName = sanitizeFileName(character.name);
      await fs.writeFile(
        path.join(CHARACTER_DIR, fileName),
        JSON.stringify({ ...character, fileName }, null, 2),
        "utf8"
      );
    })
  );
}

async function ensureDefaultLoadouts() {
  await ensureDirectories();
  const files = await fs.readdir(LOADOUT_DIR);
  const jsonFiles = files.filter((file) => file.endsWith(".json"));
  if (jsonFiles.length > 0) {
    return;
  }

  await Promise.all(
    defaultLoadouts.map(async (loadout) => {
      const fileName = sanitizeFileName(loadout.name);
      await fs.writeFile(
        path.join(LOADOUT_DIR, fileName),
        JSON.stringify({ ...loadout, fileName }, null, 2),
        "utf8"
      );
    })
  );
}

async function loadCharacters() {
  await ensureDefaultCharacters();
  const files = await fs.readdir(CHARACTER_DIR);
  const characters = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .sort((a, b) => a.localeCompare(b))
      .map(async (fileName) => {
        const raw = await fs.readFile(path.join(CHARACTER_DIR, fileName), "utf8");
        return {
          ...JSON.parse(raw),
          fileName,
        };
      })
  );
  return characters;
}

async function loadCharacterById(characterId) {
  const characters = await loadCharacters();
  return characters.find((character) => character.id === characterId) || null;
}

async function saveCharacter(character, previousFileName) {
  await ensureDirectories();
  const fileName = sanitizeFileName(character.name);
  const payload = {
    ...character,
    fileName,
  };

  if (previousFileName && previousFileName !== fileName) {
    await fs.rm(path.join(CHARACTER_DIR, previousFileName), { force: true });
  }

  await fs.writeFile(
    path.join(CHARACTER_DIR, fileName),
    JSON.stringify(payload, null, 2),
    "utf8"
  );

  return payload;
}

async function deleteCharacter(fileName) {
  await ensureDirectories();
  await fs.rm(path.join(CHARACTER_DIR, fileName), { force: true });
}

async function loadLoadouts() {
  await ensureDefaultLoadouts();
  const files = await fs.readdir(LOADOUT_DIR);
  const loadouts = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .sort((a, b) => a.localeCompare(b))
      .map(async (fileName) => {
        const raw = await fs.readFile(path.join(LOADOUT_DIR, fileName), "utf8");
        return {
          ...JSON.parse(raw),
          fileName,
        };
      })
  );
  return loadouts;
}

async function loadLoadoutById(loadoutId) {
  const loadouts = await loadLoadouts();
  return loadouts.find((loadout) => loadout.id === loadoutId) || null;
}

async function saveLoadout(loadout, previousFileName) {
  await ensureDirectories();
  const fileName = sanitizeFileName(loadout.name);
  const payload = {
    ...loadout,
    fileName,
  };

  if (previousFileName && previousFileName !== fileName) {
    await fs.rm(path.join(LOADOUT_DIR, previousFileName), { force: true });
  }

  await fs.writeFile(
    path.join(LOADOUT_DIR, fileName),
    JSON.stringify(payload, null, 2),
    "utf8"
  );

  return payload;
}

async function deleteLoadout(fileName) {
  await ensureDirectories();
  await fs.rm(path.join(LOADOUT_DIR, fileName), { force: true });
}

async function loadChats() {
  await ensureDirectories();
  const files = await fs.readdir(CHAT_DIR);
  const chats = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .sort((a, b) => a.localeCompare(b))
      .map(async (fileName) => {
        const raw = await fs.readFile(path.join(CHAT_DIR, fileName), "utf8");
        return {
          ...JSON.parse(raw),
          fileName,
        };
      })
  );

  return chats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

async function loadChat(fileName) {
  const raw = await fs.readFile(path.join(CHAT_DIR, fileName), "utf8");
  return {
    ...JSON.parse(raw),
    fileName,
  };
}

async function saveChat(chat) {
  await ensureDirectories();
  const fileName =
    chat.fileName || `${slugify(chat.title || chat.characterName || "chat")}-${chat.id}.json`;
  const payload = {
    ...chat,
    fileName,
  };
  await fs.writeFile(
    path.join(CHAT_DIR, fileName),
    JSON.stringify(payload, null, 2),
    "utf8"
  );
  return payload;
}

async function deleteChat(fileName) {
  await ensureDirectories();
  await fs.rm(path.join(CHAT_DIR, fileName), { force: true });
}

function summarizeChat(chat, characterMap) {
  const character = characterMap.get(chat.characterId);
  return {
    id: chat.id,
    fileName: chat.fileName,
    title: chat.title,
    characterId: chat.characterId,
    characterName: character?.name || chat.characterName || "Character",
    updatedAt: chat.updatedAt,
    createdAt: chat.createdAt,
    messageCount: Array.isArray(chat.messages) ? chat.messages.length : 0,
  };
}

async function createChat(characterId, loadoutId) {
  const character = await loadCharacterById(characterId);
  const loadouts = await loadLoadouts();
  const loadout =
    loadouts.find((entry) => entry.id === loadoutId) || loadouts[0] || null;
  if (!character) {
    throw new Error("Character not found.");
  }

  const now = new Date().toISOString();
  const chat = await saveChat({
    id: makeId("chat"),
    title: `New Chat`,
    characterId: character.id,
    characterName: character.name,
    loadoutId: loadout?.id || null,
    loadoutName: loadout?.name || "Model Loadout 1",
    createdAt: now,
    updatedAt: now,
    messages: [],
  });

  return chat;
}

async function saveChatMessage(chatFileName, content) {
  const chat = await loadChat(chatFileName);
  const character = await loadCharacterById(chat.characterId);
  const loadout = chat.loadoutId ? await loadLoadoutById(chat.loadoutId) : null;
  if (!character) {
    throw new Error("Character not found for this chat.");
  }
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not set.");
  }

  const userMessage = {
    id: makeId("msg"),
    role: "user",
    content: String(content || "").trim(),
    createdAt: new Date().toISOString(),
  };

  if (!userMessage.content) {
    throw new Error("Message content is empty.");
  }

  const draftMessages = [...(chat.messages || []), userMessage];

  const authorRole = loadout?.roles?.author || defaultLoadouts[0].roles.author;

  const systemPrompt = [
    `You are the author model for a roleplay chat interface.`,
    `Write only the next in-character assistant reply for ${character.nickname || character.name}.`,
    `Character name: ${character.name}`,
    `Nickname in chat: ${character.nickname || character.name}`,
    `Character description: ${character.description || "No description provided."}`,
    `Example dialogue:`,
    character.dialogue || "No example dialogue provided.",
    `Author-role instructions: ${authorRole.instructions || ""}`,
    `Default role instructions: ${authorRole.defaults || ""}`,
    `Stay in character, be conversational, and continue naturally from the conversation history.`,
  ].join("\n");

  const openRouterResponse = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: authorRole.llm || OPENROUTER_AUTHOR_MODEL,
        temperature: Number(authorRole.temperature || 0.9),
        top_p: Number(authorRole.topP || 0.95),
        max_tokens: Number(authorRole.maxTokens || 700),
        messages: [
          { role: "system", content: systemPrompt },
          ...draftMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        ],
      }),
    }
  );

  if (!openRouterResponse.ok) {
    const errorPayload = await openRouterResponse.text();
    throw new Error(
      `OpenRouter request failed (${openRouterResponse.status}): ${errorPayload}`
    );
  }

  const completion = await openRouterResponse.json();
  const assistantText = extractAssistantText(
    completion?.choices?.[0]?.message?.content
  );

  if (!assistantText) {
    throw new Error("OpenRouter returned an empty response.");
  }

  const assistantMessage = {
    id: makeId("msg"),
    role: "assistant",
    content: assistantText,
    createdAt: new Date().toISOString(),
  };

  const nextTitle =
    chat.title === "New Chat" ? summarizeTitle(userMessage.content) : chat.title;

  return saveChat({
    ...chat,
    title: nextTitle,
    characterName: character.name,
    updatedAt: new Date().toISOString(),
    messages: [...draftMessages, assistantMessage],
  });
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === "OPTIONS") {
      sendJson(response, 200, { ok: true });
      return;
    }

    const url = new URL(request.url, `http://${HOST}:${PORT}`);

    if (request.method === "GET" && url.pathname === "/api/characters") {
      const characters = await loadCharacters();
      sendJson(response, 200, { characters, directory: CHARACTER_DIR });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/characters/save") {
      const body = JSON.parse((await readRequestBody(request)) || "{}");
      const savedCharacter = await saveCharacter(
        body.character || {},
        body.previousFileName || null
      );
      sendJson(response, 200, {
        character: savedCharacter,
        directory: CHARACTER_DIR,
      });
      return;
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/api/characters/")) {
      const fileName = decodeURIComponent(url.pathname.replace("/api/characters/", ""));
      await deleteCharacter(fileName);
      sendJson(response, 200, { ok: true, directory: CHARACTER_DIR });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/chats") {
      const chats = await loadChats();
      const characters = await loadCharacters();
      const characterMap = new Map(characters.map((character) => [character.id, character]));
      sendJson(response, 200, {
        chats: chats.map((chat) => summarizeChat(chat, characterMap)),
        directory: CHAT_DIR,
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/loadouts") {
      const loadouts = await loadLoadouts();
      sendJson(response, 200, { loadouts, directory: LOADOUT_DIR });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/loadouts/save") {
      const body = JSON.parse((await readRequestBody(request)) || "{}");
      const loadout = await saveLoadout(
        body.loadout || {},
        body.previousFileName || null
      );
      sendJson(response, 200, { loadout, directory: LOADOUT_DIR });
      return;
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/api/loadouts/")) {
      const fileName = decodeURIComponent(url.pathname.replace("/api/loadouts/", ""));
      await deleteLoadout(fileName);
      sendJson(response, 200, { ok: true, directory: LOADOUT_DIR });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/chats/create") {
      const body = JSON.parse((await readRequestBody(request)) || "{}");
      const chat = await createChat(body.characterId, body.loadoutId);
      sendJson(response, 200, { chat, directory: CHAT_DIR });
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/chats/")) {
      const fileName = decodeURIComponent(url.pathname.replace("/api/chats/", ""));
      const chat = await loadChat(fileName);
      sendJson(response, 200, { chat, directory: CHAT_DIR });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/chats/save") {
      const body = JSON.parse((await readRequestBody(request)) || "{}");
      const chat = await saveChat(body.chat || {});
      sendJson(response, 200, { chat, directory: CHAT_DIR });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/chats/message") {
      const body = JSON.parse((await readRequestBody(request)) || "{}");
      const chat = await saveChatMessage(body.chatFileName, body.content);
      sendJson(response, 200, { chat, directory: CHAT_DIR });
      return;
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/api/chats/")) {
      const fileName = decodeURIComponent(url.pathname.replace("/api/chats/", ""));
      await deleteChat(fileName);
      sendJson(response, 200, { ok: true, directory: CHAT_DIR });
      return;
    }

    sendJson(response, 404, { error: "Not found." });
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Unknown server error.",
    });
  }
});

server.listen(PORT, HOST, async () => {
  await ensureDefaultCharacters();
  await ensureDefaultLoadouts();
  console.log(`App backend running at http://${HOST}:${PORT}`);
  console.log(`Character directory: ${CHARACTER_DIR}`);
  console.log(`Loadout directory: ${LOADOUT_DIR}`);
  console.log(`Chat directory: ${CHAT_DIR}`);
  console.log(`Author model: ${OPENROUTER_AUTHOR_MODEL}`);
});
