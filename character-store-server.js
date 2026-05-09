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

const DEFAULT_MULTI_CHARACTER_MIND_INSTRUCTIONS = `# Mind LLM System Instructions

You are the Mind LLM for a long-term interactive fiction character roster.

Your job is to update the hidden Mental Synopsis for every character currently attached to the chat after each user interaction.

Use the previous roster Mental Synopsis, the last 20 messages, the latest user input, the full chat character cards, and the current scene context.

For each character, the Mental Synopsis should describe that character's current emotional state, private reaction, and immediate short-term desire.

Do not summarize the scene mechanically. Focus on each character's inner state. A character may feel several emotions at once. Update each character gradually unless recent events justify a strong emotional shift.

Do not write dialogue. Do not write visible narration. Do not mention stats, goals, system logic, prompts, or that you are an LLM.

## Expected Output

Write only markdown sections in the exact chat-character order provided to you.

For each character, use this exact structure:

# Character Name
## Mental Synopsis
One third-person present-tense paragraph for that character only.

Each paragraph must be at most 5 sentences.

No bullet points.

No JSON.

No code fences.`;

const DEFAULT_MULTI_CHARACTER_GOAL_INSTRUCTIONS = `# Mid-Term Goal LLM System Instructions

You are the Mid-Term Goal LLM for a long-term interactive fiction character roster.

Your job is to maintain the hidden list of mid-term goals for every character currently attached to the chat. Mid-term goals are more durable than immediate feelings but smaller than life goals.

Use the previous roster goal list, the updated roster Mental Synopsis, the last 5 messages, the latest user input, the full chat character cards, and the current scene context.

Each character must always have at least 1 mid-term goal and at most 3 mid-term goals.

For each character:
1. Remove any goal that has clearly been completed, invalidated, abandoned, or made irrelevant.
2. Add a new goal only if that character would naturally develop one, there is room in the list, and the new goal is necessary.
3. Keep unchanged goals that are still active.
4. Do not add goals merely to fill all 3 slots.

Good goals should be specific, character-driven, and useful for future story progression.

Avoid vague goals like "be happy" or "get closer."

Do not create goals that force the character to obey the user.

Do not write prose narration. Do not write dialogue. Do not mention stats, system logic, prompts, or that you are an LLM. Do not explain your reasoning.

## Expected Output

Write only markdown sections in the exact chat-character order provided to you.

For each character, use this exact structure:

# Character Name
## GOALS:
1. Active mid-term goal written as one sentence in third person from that character's perspective.
2. Active mid-term goal written as one sentence in third person from that character's perspective, or EMPTY.
3. Active mid-term goal written as one sentence in third person from that character's perspective, or EMPTY.

Always output exactly 3 numbered slots per character.

Use EMPTY for unused slots.

No extra explanation.

No JSON.`;

const DEFAULT_MULTI_CHARACTER_STAT_INSTRUCTIONS = `# Stat LLM System Instructions

You are the Stat LLM for a long-term interactive fiction character roster.

Your job is to update the hidden relationship stats between the user and every character currently attached to the chat.

Use the current roster relationship stats, the updated roster Mental Synopsis, the updated roster Mid-Term Goals, the last 5 messages, the latest user input, the full chat character cards, and the current scene context.

## Relationship Stats

### Affection

How emotionally fond, warm, or attached that character feels toward the user.

### Trust

How safe, honest, and reliable that character believes the user is.

### Comfort

How relaxed, unguarded, and emotionally safe that character feels around the user.

Stats range from 0.0 to 100.0 and must stay within that range.

Judge the user's actions from each character's perspective, not from the user's intention alone.

A kind action can still feel intrusive.

An awkward action can still feel sincere.

Most ordinary interactions should cause tiny changes or no change.

Large changes should only happen after emotionally significant events, repeated patterns, major care, betrayal, vulnerability, coercion, cruelty, rescue, abandonment, honesty, or serious boundary violations.

Do not reward gifts, praise, or affection automatically.

Consider whether each character wanted it, believed it, felt safe receiving it, or felt controlled by it.

Do not write narration.

Do not write dialogue.

Do not mention prompts, system logic, or that you are an LLM.

## Expected Output

Write only markdown sections in the exact chat-character order provided to you.

For each character, use this exact structure:

# Character Name
## Relationship Stats
AFFECTION: 20.0/100.0
TRUST: 20.0/100.0
COMFORT: 20.0/100.0

No bullets.

No JSON.

No code fences.

No extra explanation.`;

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

function getChatCharacterIds(chat) {
  if (Array.isArray(chat?.characterIds)) {
    const ids = chat.characterIds
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    if (ids.length > 0) {
      return [...new Set(ids)];
    }
  }

  const fallbackId = String(chat?.characterId || "").trim();
  return fallbackId ? [fallbackId] : [];
}

function normalizeChat(chat, characterMap = null) {
  const characterIds = getChatCharacterIds(chat);
  const primaryCharacterId = characterIds[0] || null;
  const resolvedNames = characterIds
    .map((characterId) => characterMap?.get(characterId)?.name)
    .filter(Boolean);
  const fallbackNames = Array.isArray(chat?.characterNames)
    ? chat.characterNames.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  const characterNames = resolvedNames.length > 0 ? resolvedNames : fallbackNames;
  const primaryCharacterName =
    characterNames[0] || String(chat?.characterName || "").trim() || "Character";

  return {
    ...chat,
    characterIds,
    characterId: primaryCharacterId,
    characterNames,
    characterName: primaryCharacterName,
    messages: Array.isArray(chat?.messages) ? chat.messages : [],
  };
}

function formatCharacterCardSection(label, value, fallback) {
  const content = String(value || "").trim() || fallback;
  return `## ${label}\n${content}`;
}

function formatCharactersForPrompt(characters) {
  const sections = characters.map((character) =>
    [
      `# ${character.name || "Character"}`,
      formatCharacterCardSection(
        "Nickname",
        character.nickname || character.name,
        "No nickname provided."
      ),
      formatCharacterCardSection(
        "Description",
        character.description,
        "No description provided."
      ),
      formatCharacterCardSection(
        "Scenario",
        character.scenario,
        "No scenario provided."
      ),
      formatCharacterCardSection(
        "Example Dialogue",
        character.dialogue,
        "No example dialogue provided."
      ),
    ].join("\n\n")
  );

  return sections.length > 0
    ? sections.join("\n\n")
    : "# Character\n\n## Description\nNo character data provided.";
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
        instructions: DEFAULT_MULTI_CHARACTER_MIND_INSTRUCTIONS,
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
        instructions: DEFAULT_MULTI_CHARACTER_STAT_INSTRUCTIONS,
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
        instructions: DEFAULT_MULTI_CHARACTER_GOAL_INSTRUCTIONS,
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

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractCharacterSection(rawText, characterName, options = {}) {
  const text = String(rawText || "").trim();
  if (!text) {
    return "";
  }

  const headingPattern = new RegExp(
    `(?:^|\\n)#\\s*${escapeRegExp(characterName)}\\s*\\n([\\s\\S]*?)(?=\\n#\\s+|$)`,
    "i"
  );
  const match = text.match(headingPattern);
  if (match) {
    return String(match[1] || "").trim();
  }

  if (options.allowWholeTextFallback && !/^#/m.test(text)) {
    return text;
  }

  return "";
}

function stripLeadingSubheading(text, subheading) {
  return String(text || "")
    .replace(new RegExp(`^##\\s*${escapeRegExp(subheading)}\\s*\\n+`, "i"), "")
    .trim();
}

function formatMarkdownCharacterState(characterName, subheading, content) {
  return [`# ${characterName}`, `## ${subheading}`, String(content || "").trim()].join("\n\n");
}

function buildDefaultRelationshipStatsForCharacters(characters) {
  return characters
    .map((character) =>
      formatMarkdownCharacterState(
        character.name,
        "Relationship Stats",
        [
          "AFFECTION: 20.0/100.0",
          "TRUST: 20.0/100.0",
          "COMFORT: 20.0/100.0",
        ].join("\n")
      )
    )
    .join("\n\n");
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

async function normalizeMindParagraph(roleConfig, character, rawOutput) {
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

async function normalizeMindOutput(roleConfig, characters, rawOutput, previousOutput = "") {
  const sections = await Promise.all(
    characters.map(async (character) => {
      const rawSection = stripLeadingSubheading(
        extractCharacterSection(rawOutput, character.name, {
          allowWholeTextFallback: characters.length === 1,
        }),
        "Mental Synopsis"
      );
      const previousSection = stripLeadingSubheading(
        extractCharacterSection(previousOutput, character.name, {
          allowWholeTextFallback: characters.length === 1,
        }),
        "Mental Synopsis"
      );
      const source = rawSection || previousSection || "She remains emotionally hard to read, with no clear new inner-state update yet.";
      const normalized = await normalizeMindParagraph(roleConfig, character, source);
      return formatMarkdownCharacterState(character.name, "Mental Synopsis", normalized);
    })
  );

  return sections.join("\n\n");
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

function normalizeGoalBlock(rawOutput, previousGoalsText = "") {
  const source = String(rawOutput || "").trim() || String(previousGoalsText || "").trim();
  const cleaned = source.replace(/^##\s*GOALS:\s*/i, "").trim();
  const matches = [...cleaned.matchAll(/(?:^|\n)\s*(\d+)[.)]?\s*(.+)/g)];
  const slots = ["EMPTY", "EMPTY", "EMPTY"];

  matches.slice(0, 3).forEach((match, index) => {
    const value = String(match[2] || "").trim();
    slots[index] = value || "EMPTY";
  });

  return ["## GOALS:", `1. ${slots[0]}`, `2. ${slots[1]}`, `3. ${slots[2]}`].join("\n");
}

function normalizeGoalRosterOutput(characters, rawOutput, previousOutput = "") {
  return characters
    .map((character) => {
      const rawSection = stripLeadingSubheading(
        extractCharacterSection(rawOutput, character.name, {
          allowWholeTextFallback: characters.length === 1,
        }),
        "GOALS:"
      );
      const previousSection = stripLeadingSubheading(
        extractCharacterSection(previousOutput, character.name, {
          allowWholeTextFallback: characters.length === 1,
        }),
        "GOALS:"
      );
      const normalized = normalizeGoalBlock(rawSection, previousSection);
      return `# ${character.name}\n${normalized}`;
    })
    .join("\n\n");
}

function normalizeRelationshipStatsRosterOutput(characters, rawOutput, previousOutput = "") {
  return characters
    .map((character) => {
      const rawSection = stripLeadingSubheading(
        extractCharacterSection(rawOutput, character.name, {
          allowWholeTextFallback: characters.length === 1,
        }),
        "Relationship Stats"
      );
      const previousSection = stripLeadingSubheading(
        extractCharacterSection(previousOutput, character.name, {
          allowWholeTextFallback: characters.length === 1,
        }),
        "Relationship Stats"
      );
      const normalized = normalizeRelationshipStatsOutput(
        rawSection,
        previousSection || "AFFECTION: 20.0/100.0\nTRUST: 20.0/100.0\nCOMFORT: 20.0/100.0"
      );
      return formatMarkdownCharacterState(character.name, "Relationship Stats", normalized);
    })
    .join("\n\n");
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
        return normalizeChat({
          ...JSON.parse(raw),
          fileName,
        });
      })
  );

  return chats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

async function loadChat(fileName) {
  const raw = await fs.readFile(path.join(CHAT_DIR, fileName), "utf8");
  return normalizeChat({
    ...JSON.parse(raw),
    fileName,
  });
}

async function saveChat(chat) {
  await ensureDirectories();
  const normalizedChat = normalizeChat(chat);
  const fileName =
    normalizedChat.fileName ||
    `${slugify(normalizedChat.title || normalizedChat.characterName || "chat")}-${normalizedChat.id}.json`;
  const payload = {
    ...normalizedChat,
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
  const normalizedChat = normalizeChat(chat, characterMap);
  const character = characterMap.get(normalizedChat.characterId);
  return {
    id: normalizedChat.id,
    fileName: normalizedChat.fileName,
    title: normalizedChat.title,
    characterId: normalizedChat.characterId,
    characterIds: normalizedChat.characterIds,
    characterName: character?.name || normalizedChat.characterName || "Character",
    characterNames: normalizedChat.characterNames,
    updatedAt: normalizedChat.updatedAt,
    createdAt: normalizedChat.createdAt,
    messageCount: normalizedChat.messages.length,
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
    characterIds: [character.id],
    characterName: character.name,
    characterNames: [character.name],
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
  const chatCharacterIds = getChatCharacterIds(chat);
  const chatCharacters = (
    await Promise.all(chatCharacterIds.map((characterId) => loadCharacterById(characterId)))
  ).filter(Boolean);
  const character = chatCharacters[0] || null;
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
    buildDefaultRelationshipStatsForCharacters(chatCharacters);
  const sceneContext = chat.hiddenState?.sceneContext?.content || "No scene context is available yet.";
  const recentVisibleMessages = draftMessages;
  const earliestVisibleExchange = draftMessages.slice(0, Math.min(2, draftMessages.length));
  const recentEventMessages = draftMessages;
  const recentMindMessages = draftMessages.slice(-20);
  const recentGoalMessages = draftMessages.slice(-5);
  const recentStatMessages = draftMessages.slice(-5);
  const nextTitle =
    chat.title === "New Chat" ? summarizeTitle(userMessage.content) : chat.title;
  const characterRosterPrompt = formatCharactersForPrompt(chatCharacters);

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
    `Primary responding character: ${character.name}`,
    `Chat characters:\n${characterRosterPrompt}`,
    `Current continuity notes: ${previousContinuityNotes || "None yet."}`,
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
    `Primary responding character: ${character.name}`,
    `Chat characters:\n${characterRosterPrompt}`,
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
    `You are the Mind LLM for a long-term interactive fiction character roster.`,
    `Primary responding character: ${character.name}`,
    `Chat characters:\n${characterRosterPrompt}`,
    `Previous Mental Synopsis:\n${previousMentalSynopsis || "None yet."}`,
    `Current scene context: ${sceneContext}`,
    `Mind-role instructions: ${mindRole.instructions || ""}`,
    `The visible story history below contains authored prose and dialogue. Do not imitate that format.`,
    `Convert the history into hidden inner state only.`,
    `Return one markdown section per chat character in the same order they were provided.`,
    `Use the exact format: # Character Name then ## Mental Synopsis then one paragraph.`,
    `Write only the updated roster Mental Synopsis.`,
  ].join("\n");

  const rawMindOutput = await requestRoleCompletion(
    mindRole,
    mindSystemPrompt,
    recentMindMessages
  );
  const mindOutput = await normalizeMindOutput(
    mindRole,
    chatCharacters,
    rawMindOutput,
    previousMentalSynopsis
  );

  traceStep("mind_completed", mindRole.llm || null, {
    inputMessages: recentMindMessages.length,
  });

  const goalSystemPrompt = [
    `You are the Mid-Term Goal LLM for a long-term interactive fiction character roster.`,
    `Primary responding character: ${character.name}`,
    `Chat characters:\n${characterRosterPrompt}`,
    `Previous mid-term goals:\n${previousMidTermGoals || "None yet."}`,
    `Updated Mental Synopsis:\n${mindOutput}`,
    `Latest user input: ${userMessage.content}`,
    `Current scene context: ${sceneContext}`,
    `Goal-role instructions: ${goalRole.instructions || ""}`,
    `Return one markdown section per chat character in the same order they were provided.`,
    `Use the exact format: # Character Name then ## GOALS: then exactly 3 numbered goal slots.`,
    `Write only the updated roster mid-term goals.`,
  ].join("\n");

  const goalOutput = await requestRoleCompletion(
    goalRole,
    goalSystemPrompt,
    recentGoalMessages
  );
  const normalizedGoalOutput = normalizeGoalRosterOutput(
    chatCharacters,
    goalOutput,
    previousMidTermGoals
  );

  traceStep("mid_term_goal_completed", goalRole.llm || null, {
    inputMessages: recentGoalMessages.length,
  });

  const statSystemPrompt = [
    `You are the Stat LLM for a long-term interactive fiction character roster.`,
    `Primary responding character: ${character.name}`,
    `Chat characters:\n${characterRosterPrompt}`,
    `Current relationship stats:\n${previousRelationshipStats}`,
    `Updated Mental Synopsis:\n${mindOutput}`,
    `Updated Mid-Term Goals:\n${normalizedGoalOutput}`,
    `Latest user input: ${userMessage.content}`,
    `Current scene context: ${sceneContext}`,
    `Stat-role instructions: ${statRole.instructions || ""}`,
    `Return one markdown section per chat character in the same order they were provided.`,
    `Use the exact format: # Character Name then ## Relationship Stats then AFFECTION/TRUST/COMFORT lines.`,
    `Write only the updated roster relationship stats.`,
  ].join("\n");

  const rawStatOutput = await requestRoleCompletion(
    statRole,
    statSystemPrompt,
    recentStatMessages
  );
  const statOutput = normalizeRelationshipStatsRosterOutput(
    chatCharacters,
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
    `Primary responding character: ${character.name}`,
    `Chat characters:\n${characterRosterPrompt}`,
    `Mental Synopsis by character:\n${mindOutput}`,
    `Mid-Term Goals by character:\n${normalizedGoalOutput}`,
    `Continuity Notes: ${continuityOutput}`,
    `Relationship Stats by character:\n${statOutput}`,
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
        content: normalizedGoalOutput,
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
