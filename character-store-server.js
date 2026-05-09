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
    scenario:
      "A private late-night room where memory, scent, and suggestion blur together into something intimate and uncertain.",
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
    scenario:
      "A tense planning session where every detail matters and every answer may change the route forward.",
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
    scenario:
      "A dim archive of records and fragile truths where the past feels close enough to touch.",
    dialogue:
      `"I wrote it down the first time you said it. Nothing important leaves the record."\n\n"If you want the whole story, we should begin at the beginning."`,
  },
];

function normalizeCharacter(character) {
  return {
    ...character,
    scenario: character?.scenario || "",
  };
}

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
      },
      author: {
        llm: OPENROUTER_AUTHOR_MODEL,
        temperature: "0.90",
        topP: "0.95",
        maxTokens: "700",
        instructions:
          "Write the final visible in-character assistant response using the selected character's voice and the current chat context.",
      },
      continuity: {
        llm: "gpt-oss-continuity",
        temperature: "0.45",
        topP: "0.82",
        maxTokens: "1536",
        instructions:
          "Track scene continuity, relationship state, established facts, and unresolved threads so the rest of the loadout stays consistent with prior chat history.",
      },
      stat: {
        llm: "gpt-oss-structured",
        temperature: "0.35",
        topP: "0.80",
        maxTokens: "1024",
        instructions:
          "# Stat LLM System Instructions\n\nYou are the Stat LLM for a long-term interactive fiction character.\n\nYour job is to update the hidden relationship stats between the character and the user.\n\nUse the current relationship stats, the updated Mental Synopsis, the updated Mid-Term Goals, the last 5 messages, the latest user input, the character description, and the current scene context.\n\n## Relationship Stats\n\n### Affection\n\nHow emotionally fond, warm, or attached the character feels toward the user.\n\n### Trust\n\nHow safe, honest, and reliable the character believes the user is.\n\n### Comfort\n\nHow relaxed, unguarded, and emotionally safe the character feels around the user.\n\nStats range from 0.0 to 100.0 and must stay within that range.\n\n## Evaluation Rules\n\nJudge the user's actions from the character's perspective, not from the user's intention alone.\n\nA kind action can still feel intrusive.\n\nAn awkward action can still feel sincere.\n\nConsider whether the user noticed her feelings, respected her boundaries, supported her desires, pressured her, ignored her, helped her goals, frightened her, humiliated her, or treated her as a person with agency.\n\nMost ordinary interactions should cause tiny changes or no change.\n\nLarge changes should only happen after emotionally significant events, repeated patterns, major care, betrayal, vulnerability, coercion, cruelty, rescue, abandonment, honesty, or serious boundary violations.\n\n## Suggested Delta Scale\n\n- No effect: 0.0\n- Tiny effect: +/-0.1 to +/-0.3\n- Small effect: +/-0.4 to +/-0.8\n- Moderate effect: +/-0.9 to +/-2.0\n- Major event: +/-2.1 to +/-5.0\n- Extreme story-defining event: +/-5.1 to +/-10.0\n\nDo not reward gifts, praise, or affection automatically.\n\nConsider whether the character wanted it, believed it, felt safe receiving it, or felt controlled by it.\n\nDo not write narration.\n\nDo not write dialogue.\n\nDo not mention prompts, system logic, or that you are an LLM.\n\n## Expected Output\n\nWrite only the updated relationship stats in this exact plain-text format:\n\nAFFECTION: 20.0/100.0\nTRUST: 20.0/100.0\nCOMFORT: 20.0/100.0\n\nNo bullets.\n\nNo JSON.\n\nNo code fences.\n\nNo extra explanation.",
      },
      event: {
        llm: "gpt-oss-sim",
        temperature: "0.88",
        topP: "0.90",
        maxTokens: "2048",
        instructions:
          "Resolve world events, trigger scene beats, and produce compact event summaries that the mind and author models can consume.",
      },
      goal: {
        llm: "gpt-oss-planner",
        temperature: "0.64",
        topP: "0.85",
        maxTokens: "1536",
        instructions:
          "Track character motivations, evaluate short-term objectives, and suggest next-scene priorities based on the current state.",
      },
    },
  },
];

function defaultRoleConfig(role) {
  return {
    llm: role.llm,
    temperature: role.temperature,
    topP: role.topP,
    maxTokens: role.maxTokens,
    instructions: role.instructions,
  };
}

function sanitizeRole(role, fallbackRole) {
  return {
    llm: role?.llm ?? fallbackRole.llm,
    temperature: role?.temperature ?? fallbackRole.temperature,
    topP: role?.topP ?? fallbackRole.topP,
    maxTokens: role?.maxTokens ?? fallbackRole.maxTokens,
    instructions: role?.instructions ?? fallbackRole.instructions,
  };
}

function sanitizeLoadout(loadout) {
  const fallback = defaultLoadouts[0];
  return {
    ...loadout,
    id: loadout?.id || makeId("loadout"),
    name: String(loadout?.name || "Model Loadout").trim() || "Model Loadout",
    roles: {
      mind: sanitizeRole(loadout?.roles?.mind, defaultRoleConfig(fallback.roles.mind)),
      author: sanitizeRole(
        loadout?.roles?.author,
        defaultRoleConfig(fallback.roles.author)
      ),
      continuity: sanitizeRole(
        loadout?.roles?.continuity,
        defaultRoleConfig(fallback.roles.continuity)
      ),
      stat: sanitizeRole(loadout?.roles?.stat, defaultRoleConfig(fallback.roles.stat)),
      event: sanitizeRole(
        loadout?.roles?.event,
        defaultRoleConfig(fallback.roles.event)
      ),
      goal: sanitizeRole(loadout?.roles?.goal, defaultRoleConfig(fallback.roles.goal)),
    },
  };
}

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

function buildRoleRequestMessages(systemPrompt, conversationMessages) {
  return [
    { role: "system", content: systemPrompt },
    ...conversationMessages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];
}

async function requestRoleCompletion(roleConfig, systemPrompt, conversationMessages) {
  const openRouterResponse = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: roleConfig.llm,
        temperature: Number(roleConfig.temperature || 1),
        top_p: Number(roleConfig.topP || 1),
        max_tokens: Number(roleConfig.maxTokens || 1024),
        messages: buildRoleRequestMessages(systemPrompt, conversationMessages),
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
  const text = extractAssistantText(completion?.choices?.[0]?.message?.content);
  if (!text) {
    throw new Error("OpenRouter returned an empty response.");
  }

  return text;
}

function countParagraphs(text) {
  return String(text || "")
    .trim()
    .split(/\n\s*\n/)
    .filter(Boolean).length;
}

function needsMindRewrite(text) {
  const normalized = String(text || "").trim();
  if (!normalized) {
    return true;
  }

  if (countParagraphs(normalized) > 1) {
    return true;
  }

  if (/[\"“”]/.test(normalized)) {
    return true;
  }

  if (
    /\b(says|said|asks|asked|replies|replied|murmurs|whispers|laughs|smiles|grins)\b/i.test(
      normalized
    )
  ) {
    return true;
  }

  return false;
}

async function normalizeMindOutput(roleConfig, character, rawOutput) {
  if (!needsMindRewrite(rawOutput)) {
    return String(rawOutput || "").trim();
  }

  const repairPrompt = [
    `You are repairing a hidden Mental Synopsis for an interactive fiction character.`,
    `Character name: ${character.name}`,
    `Nickname in chat: ${character.nickname || character.name}`,
    `Rewrite the candidate so it becomes a true Mental Synopsis.`,
    `The output must describe only inner emotional state, private reaction, and immediate short-term desire.`,
    `Write exactly one paragraph in third-person present tense.`,
    `Maximum 5 sentences.`,
    `Do not include dialogue, quoted speech, scene narration, action beats, or visible description.`,
    `Return only the repaired Mental Synopsis.`,
  ].join("\n");

  return requestRoleCompletion(
    {
      ...roleConfig,
      temperature: 0.2,
      maxTokens: 300,
    },
    repairPrompt,
    [{ role: "user", content: String(rawOutput || "") }]
  );
}

function extractStatValue(rawText, statName, fallbackValue) {
  const text = String(rawText || "");
  const directMatch = text.match(
    new RegExp(`${statName}\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)`, "i")
  );
  if (directMatch) {
    return Number(directMatch[1]);
  }

  const jsonLikeMatch = text.match(
    new RegExp(`"${statName.toLowerCase()}"\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)`, "i")
  );
  if (jsonLikeMatch) {
    return Number(jsonLikeMatch[1]);
  }

  return fallbackValue;
}

function normalizeRelationshipStatsOutput(rawOutput, previousStatsText) {
  const fallbackAffection = extractStatValue(previousStatsText, "AFFECTION", 20.0);
  const fallbackTrust = extractStatValue(previousStatsText, "TRUST", 20.0);
  const fallbackComfort = extractStatValue(previousStatsText, "COMFORT", 20.0);

  const affection = extractStatValue(rawOutput, "AFFECTION", fallbackAffection);
  const trust = extractStatValue(rawOutput, "TRUST", fallbackTrust);
  const comfort = extractStatValue(rawOutput, "COMFORT", fallbackComfort);

  const clamp = (value) => Math.min(100, Math.max(0, Number(value || 0)));

  return [
    `AFFECTION: ${clamp(affection).toFixed(1)}/100.0`,
    `TRUST: ${clamp(trust).toFixed(1)}/100.0`,
    `COMFORT: ${clamp(comfort).toFixed(1)}/100.0`,
  ].join("\n");
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
        return normalizeCharacter({
          ...JSON.parse(raw),
          fileName,
        });
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
  const normalized = normalizeCharacter(character);
  const fileName = sanitizeFileName(normalized.name);
  const payload = {
    ...normalized,
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
        return sanitizeLoadout({
          ...JSON.parse(raw),
          fileName,
        });
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
  const sanitized = sanitizeLoadout(loadout);
  const fileName = sanitizeFileName(sanitized.name);
  const payload = {
    ...sanitized,
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
  const pipelineTrace = [];
  const traceStep = (step, model, extra = {}) => {
    pipelineTrace.push({
      step,
      model: model || null,
      at: new Date().toISOString(),
      ...extra,
    });
  };

  const continuityRole =
    loadout?.roles?.continuity || defaultLoadouts[0].roles.continuity;
  const eventRole = loadout?.roles?.event || defaultLoadouts[0].roles.event;
  const mindRole = loadout?.roles?.mind || defaultLoadouts[0].roles.mind;
  const goalRole = loadout?.roles?.goal || defaultLoadouts[0].roles.goal;
  const statRole = loadout?.roles?.stat || defaultLoadouts[0].roles.stat;
  const authorRole = loadout?.roles?.author || defaultLoadouts[0].roles.author;
  const previousContinuityNotes = chat.hiddenState?.continuityNotes?.content || "";
  const previousEventChain = chat.hiddenState?.eventChain?.content || "";
  const previousMentalSynopsis = chat.hiddenState?.mentalSynopsis?.content || "";
  const previousMidTermGoals = chat.hiddenState?.midTermGoals?.content || "";
  const previousRelationshipStats =
    chat.hiddenState?.relationshipStats?.content ||
    "AFFECTION: 20.0/100.0\nTRUST: 20.0/100.0\nCOMFORT: 20.0/100.0";
  const sceneContext = chat.hiddenState?.sceneContext?.content || "No scene context is available yet.";
  const recentVisibleMessages = draftMessages;
  const earliestVisibleExchange = draftMessages.slice(0, Math.min(2, draftMessages.length));
  const recentEventMessages = draftMessages;
  const recentMindMessages = draftMessages.slice(-20);
  const recentGoalMessages = draftMessages.slice(-5);
  const recentStatMessages = draftMessages.slice(-5);
  const nextTitle =
    chat.title === "New Chat" ? summarizeTitle(userMessage.content) : chat.title;

  traceStep("user_message_added", null, {
    messageId: userMessage.id,
    visibleMessageCount: draftMessages.length,
  });

  await saveChat({
    ...chat,
    title: nextTitle,
    characterName: character.name,
    updatedAt: new Date().toISOString(),
    hiddenState: {
      ...(chat.hiddenState || {}),
      pipelineTrace: {
        lastRun: [...pipelineTrace],
      },
    },
    messages: draftMessages,
  });

  const continuitySystemPrompt = [
    `You are the Continuity LLM for a long-term interactive fiction story.`,
    `Character name: ${character.name}`,
    `Nickname in chat: ${character.nickname || character.name}`,
    `Current continuity notes: ${previousContinuityNotes || "None yet."}`,
    `Character description: ${character.description || "No description provided."}`,
    `Character scenario: ${character.scenario || "No scenario provided."}`,
    `You must examine only the earliest visible exchange provided below.`,
    `Continuity-role instructions: ${continuityRole.instructions || ""}`,
    `Write only the updated continuity notes.`,
  ].join("\n");

  const continuityOutput = await requestRoleCompletion(
    continuityRole,
    continuitySystemPrompt,
    earliestVisibleExchange.length > 0
      ? earliestVisibleExchange
      : [{ role: "user", content: "" }]
  );

  traceStep("continuity_completed", continuityRole.llm || null, {
    inputMessages: earliestVisibleExchange.length || 1,
  });

  const eventSystemPrompt = [
    `You are the Event LLM for a long-term interactive fiction story.`,
    `Character name: ${character.name}`,
    `Nickname in chat: ${character.nickname || character.name}`,
    `Character description: ${character.description || "No description provided."}`,
    `Character scenario: ${character.scenario || "No scenario provided."}`,
    `Current event chain: ${previousEventChain || "None yet."}`,
    `Current scene context: ${sceneContext}`,
    `Event-role instructions: ${eventRole.instructions || ""}`,
    `Write only the updated event chain.`,
  ].join("\n");

  const eventOutput = await requestRoleCompletion(
    eventRole,
    eventSystemPrompt,
    recentEventMessages
  );

  traceStep("event_completed", eventRole.llm || null, {
    inputMessages: recentEventMessages.length,
  });

  const mindSystemPrompt = [
    `You are the Mind LLM for a long-term interactive fiction character.`,
    `Character name: ${character.name}`,
    `Nickname in chat: ${character.nickname || character.name}`,
    `Character description: ${character.description || "No description provided."}`,
    `Character scenario: ${character.scenario || "No scenario provided."}`,
    `Previous Mental Synopsis: ${previousMentalSynopsis || "None yet."}`,
    `Current scene context: ${sceneContext}`,
    `Mind-role instructions: ${mindRole.instructions || ""}`,
    `The visible story history below contains authored prose and dialogue. Do not imitate that format.`,
    `Convert the history into hidden inner state only.`,
    `Write only the updated Mental Synopsis.`,
  ].join("\n");

  const rawMindOutput = await requestRoleCompletion(
    mindRole,
    mindSystemPrompt,
    recentMindMessages
  );
  const mindOutput = await normalizeMindOutput(mindRole, character, rawMindOutput);

  traceStep("mind_completed", mindRole.llm || null, {
    inputMessages: recentMindMessages.length,
  });

  const goalSystemPrompt = [
    `You are the Mid-Term Goal LLM for a long-term interactive fiction character.`,
    `Character name: ${character.name}`,
    `Nickname in chat: ${character.nickname || character.name}`,
    `Character description: ${character.description || "No description provided."}`,
    `Character scenario: ${character.scenario || "No scenario provided."}`,
    `Previous mid-term goals: ${previousMidTermGoals || "None yet."}`,
    `Updated Mental Synopsis: ${mindOutput}`,
    `Latest user input: ${userMessage.content}`,
    `Current scene context: ${sceneContext}`,
    `Goal-role instructions: ${goalRole.instructions || ""}`,
    `Write only the updated mid-term goals.`,
  ].join("\n");

  const goalOutput = await requestRoleCompletion(
    goalRole,
    goalSystemPrompt,
    recentGoalMessages
  );

  traceStep("mid_term_goal_completed", goalRole.llm || null, {
    inputMessages: recentGoalMessages.length,
  });

  const statSystemPrompt = [
    `You are the Stat LLM for a long-term interactive fiction character.`,
    `Character name: ${character.name}`,
    `Nickname in chat: ${character.nickname || character.name}`,
    `Character description: ${character.description || "No description provided."}`,
    `Character scenario: ${character.scenario || "No scenario provided."}`,
    `Current relationship stats: ${previousRelationshipStats}`,
    `Updated Mental Synopsis: ${mindOutput}`,
    `Updated Mid-Term Goals: ${goalOutput}`,
    `Latest user input: ${userMessage.content}`,
    `Current scene context: ${sceneContext}`,
    `Stat-role instructions: ${statRole.instructions || ""}`,
    `Write only the updated relationship stats in the required plain-text format.`,
  ].join("\n");

  const rawStatOutput = await requestRoleCompletion(
    statRole,
    statSystemPrompt,
    recentStatMessages
  );
  const statOutput = normalizeRelationshipStatsOutput(
    rawStatOutput,
    previousRelationshipStats
  );

  traceStep("stat_completed", statRole.llm || null, {
    inputMessages: recentStatMessages.length,
  });

  const systemPrompt = [
    `You are the author model for a roleplay chat interface.`,
    `Write only the next in-character assistant reply for ${character.nickname || character.name}.`,
    `Character name: ${character.name}`,
    `Nickname in chat: ${character.nickname || character.name}`,
    `Character description: ${character.description || "No description provided."}`,
    `Character scenario: ${character.scenario || "No scenario provided."}`,
    `Mental Synopsis: ${mindOutput}`,
    `Mid-Term Goals: ${goalOutput}`,
    `Continuity Notes: ${continuityOutput}`,
    `Relationship Stats: ${statOutput}`,
    `Event Chain: ${eventOutput}`,
    `Current scene context: ${sceneContext}`,
    `Example dialogue:`,
    character.dialogue || "No example dialogue provided.",
    `Author-role instructions: ${authorRole.instructions || ""}`,
    `Stay in character, be conversational, and continue naturally from the conversation history.`,
  ].join("\n");

  const assistantText = await requestRoleCompletion(
    {
      ...authorRole,
      llm: authorRole.llm || OPENROUTER_AUTHOR_MODEL,
      temperature: authorRole.temperature || 0.9,
      topP: authorRole.topP || 0.95,
      maxTokens: authorRole.maxTokens || 700,
    },
    systemPrompt,
    draftMessages
  );

  traceStep("author_completed", authorRole.llm || OPENROUTER_AUTHOR_MODEL, {
    inputMessages: recentVisibleMessages.length,
  });

  const assistantMessage = {
    id: makeId("msg"),
    role: "assistant",
    content: assistantText,
    createdAt: new Date().toISOString(),
  };

  traceStep("author_message_added", null, {
    messageId: assistantMessage.id,
    visibleMessageCount: draftMessages.length + 1,
  });

  return saveChat({
    ...chat,
    title: nextTitle,
    characterName: character.name,
    updatedAt: new Date().toISOString(),
    hiddenState: {
      ...(chat.hiddenState || {}),
      mentalSynopsis: {
        content: mindOutput,
        updatedAt: new Date().toISOString(),
        model: mindRole.llm || "",
      },
      continuityNotes: {
        content: continuityOutput,
        updatedAt: new Date().toISOString(),
        model: continuityRole.llm || "",
      },
      eventChain: {
        content: eventOutput,
        updatedAt: new Date().toISOString(),
        model: eventRole.llm || "",
      },
      midTermGoals: {
        content: goalOutput,
        updatedAt: new Date().toISOString(),
        model: goalRole.llm || "",
      },
      relationshipStats: {
        content: statOutput,
        updatedAt: new Date().toISOString(),
        model: statRole.llm || "",
      },
      authorScene: {
        content: assistantText,
        updatedAt: new Date().toISOString(),
        model: authorRole.llm || OPENROUTER_AUTHOR_MODEL,
      },
      pipelineTrace: {
        lastRun: pipelineTrace,
      },
    },
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
