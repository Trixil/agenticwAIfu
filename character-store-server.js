const http = require("node:http");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");

const HOST = "127.0.0.1";
const PORT = 4317;
const CHARACTER_DIR = path.join(__dirname, "character-library");
const CHAT_DIR = path.join(__dirname, "chat-library");
const PIPELINE_DEBUG_DIR = path.join(CHAT_DIR, "pipeline-debug");
const EVENT_CHAIN_DUMP_PATH = path.join(CHAT_DIR, "latest-event-chain.txt");
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
const OPENROUTER_REQUEST_TIMEOUT_MS = Math.max(
  1000,
  Number(process.env.OPENROUTER_REQUEST_TIMEOUT_MS) || 120000
);
const EDIT_REGEN_REPLAY_TIMEOUT_MS = Math.max(
  1000,
  Number(process.env.EDIT_REGEN_REPLAY_TIMEOUT_MS) || 15000
);
const EDIT_REGEN_REPLAY_USER_TURN_LIMIT = Math.max(
  1,
  Number(process.env.EDIT_REGEN_REPLAY_USER_TURN_LIMIT) || 8
);

const PIPELINE_STEP_KEYS = ["continuity", "event", "mind", "goal", "stat", "author"];

const PIPELINE_OUTPUT_KEYS = {
  continuity: "continuityOutput",
  event: "eventOutput",
  mind: "mindOutput",
  goal: "goalOutput",
  stat: "statOutput",
  author: "authorOutput",
};

const PIPELINE_OUTPUT_LABELS = {
  continuityOutput: "Continuity Output",
  eventOutput: "Event Output",
  mindOutput: "Mind Output",
  goalOutput: "Goal Output",
  statOutput: "Stat Output",
  authorOutput: "Author Output",
};

const PIPELINE_OUTPUT_TO_HIDDEN_STATE = {
  continuityOutput: "continuityNotes",
  eventOutput: "eventChain",
  mindOutput: "mentalSynopsis",
  goalOutput: "midTermGoals",
  statOutput: "relationshipStats",
  authorOutput: "authorScene",
};

const PIPELINE_PREVIOUS_OUTPUT_OPTIONS = [
  "continuityOutput",
  "eventOutput",
  "mindOutput",
  "goalOutput",
  "statOutput",
  "authorOutput",
];

const DEFAULT_PIPELINE_CONFIG = {
  order: ["continuity", "event", "mind", "goal", "stat", "author"],
  steps: {
    continuity: {
      previousOutputs: ["continuityOutput"],
      messageWindow: 2,
      includeCharacterCards: true,
    },
    event: {
      previousOutputs: ["eventOutput"],
      messageWindow: 999999,
      includeCharacterCards: true,
    },
    mind: {
      previousOutputs: ["mindOutput"],
      messageWindow: 20,
      includeCharacterCards: true,
    },
    goal: {
      previousOutputs: ["goalOutput", "mindOutput"],
      messageWindow: 5,
      includeCharacterCards: true,
    },
    stat: {
      previousOutputs: ["statOutput", "mindOutput", "goalOutput"],
      messageWindow: 5,
      includeCharacterCards: true,
    },
    author: {
      previousOutputs: [
        "mindOutput",
        "goalOutput",
        "continuityOutput",
        "statOutput",
        "eventOutput",
      ],
      messageWindow: 999999,
      includeCharacterCards: true,
    },
  },
};

const PIPELINE_TRACE_LABELS = {
  continuity: "continuity_completed",
  event: "event_completed",
  mind: "mind_completed",
  goal: "mid_term_goal_completed",
  stat: "stat_completed",
  author: "author_completed",
};

const pendingRegenerationJobs = new Map();

function createDefaultPipelineConfig() {
  return JSON.parse(JSON.stringify(DEFAULT_PIPELINE_CONFIG));
}

function isPendingAssistantMessage(message) {
  return message?.role === "assistant" && message?.pending === true;
}

function stripPendingAssistantMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages.filter((message) => !isPendingAssistantMessage(message));
}

function hasPendingRegenerationJobForChat(chatFileName) {
  return Array.from(pendingRegenerationJobs.keys()).some((jobKey) =>
    jobKey.startsWith(`${chatFileName}:`)
  );
}

function isLatestPendingRegeneration(jobKey, requestId) {
  return pendingRegenerationJobs.get(jobKey)?.requestId === requestId;
}

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
    pipeline: createDefaultPipelineConfig(),
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

function sanitizePipelineStep(stepConfig, fallbackStepConfig) {
  const rawPreviousOutputs = Array.isArray(stepConfig?.previousOutputs)
    ? stepConfig.previousOutputs
    : fallbackStepConfig.previousOutputs;
  const previousOutputs = rawPreviousOutputs
    .map((value) => String(value || "").trim())
    .filter((value) => PIPELINE_PREVIOUS_OUTPUT_OPTIONS.includes(value));

  const normalizedWindow = Number(stepConfig?.messageWindow);
  const fallbackWindow = Number(fallbackStepConfig.messageWindow);
  const messageWindow =
    Number.isFinite(normalizedWindow) && normalizedWindow > 0
      ? Math.floor(normalizedWindow)
      : fallbackWindow;

  return {
    previousOutputs: [...new Set(previousOutputs)],
    messageWindow,
    includeCharacterCards:
      typeof stepConfig?.includeCharacterCards === "boolean"
        ? stepConfig.includeCharacterCards
        : fallbackStepConfig.includeCharacterCards,
  };
}

function sanitizePipeline(pipeline) {
  const fallback = createDefaultPipelineConfig();
  const rawOrder = Array.isArray(pipeline?.order) ? pipeline.order : fallback.order;
  const normalizedNonAuthorOrder = rawOrder
    .map((value) => String(value || "").trim())
    .filter((value) => PIPELINE_STEP_KEYS.includes(value) && value !== "author");
  const defaultNonAuthorOrder = fallback.order.filter((step) => step !== "author");
  const order = [
    ...new Set([
      ...normalizedNonAuthorOrder,
      ...defaultNonAuthorOrder.filter((step) => !normalizedNonAuthorOrder.includes(step)),
    ]),
    "author",
  ];

  const steps = Object.fromEntries(
    order.map((stepKey) => [
      stepKey,
      sanitizePipelineStep(pipeline?.steps?.[stepKey], fallback.steps[stepKey]),
    ])
  );

  return { order, steps };
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
    pipeline: sanitizePipeline(loadout?.pipeline),
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
  const messages = [];
  const normalizedSystemPrompt = String(systemPrompt || "").trim();
  if (normalizedSystemPrompt) {
    messages.push({ role: "system", content: normalizedSystemPrompt });
  }

  messages.push(
    ...conversationMessages.map((message) => ({
      role: message.role,
      content: message.content,
    }))
  );

  return messages;
}

function formatIsoTimestampForFile(value) {
  return String(value || new Date().toISOString()).replace(/[:.]/g, "-");
}

function formatTextBlock(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function formatPipelineMessagesForDebug(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return "[none]";
  }

  return messages
    .map(
      (message, index) =>
        `-- Message ${index + 1} (${message.role || "unknown"}) --\n${formatTextBlock(
          message.content,
          "[empty]"
        )}`
    )
    .join("\n\n");
}

function buildPipelineDebugText(debugRun) {
  const lines = [];
  lines.push("=== Run Metadata ===");
  lines.push(`Run Started At: ${debugRun.startedAt || ""}`);
  lines.push(`Run Status: ${debugRun.status || "unknown"}`);
  lines.push(`Chat ID: ${debugRun.chatId || ""}`);
  lines.push(`Chat File: ${debugRun.chatFileName || ""}`);
  lines.push(`Loadout Name: ${debugRun.loadoutName || ""}`);
  lines.push(`Configured Pipeline Order: ${(debugRun.pipelineOrder || []).join(" -> ")}`);
  if (debugRun.errorMessage) {
    lines.push(`Error: ${debugRun.errorMessage}`);
  }

  (debugRun.steps || []).forEach((step, index) => {
    lines.push("");
    lines.push(`=== Step ${index + 1}: ${step.stepName} ===`);
    lines.push(`Model: ${step.model || ""}`);
    lines.push(`Output Key: ${step.outputKey || ""}`);
    lines.push(`Message Window Used: ${step.messageWindowLabel || ""}`);
    lines.push(
      `Include Character Cards: ${step.includeCharacterCards ? "yes" : "no"}`
    );
    lines.push(
      `Requested Previous Outputs: ${
        step.previousOutputsRequested?.length
          ? step.previousOutputsRequested.join(", ")
          : "[none]"
      }`
    );
    lines.push("");
    lines.push("Input Messages:");
    lines.push(formatPipelineMessagesForDebug(step.inputMessages));
    lines.push("");
    lines.push("Resolved Previous Outputs:");
    if (step.resolvedInputs?.length) {
      step.resolvedInputs.forEach((input) => {
        lines.push(
          `- ${input.label} [${input.outputKey}] (${input.source})`
        );
        lines.push(formatTextBlock(input.value, "[empty]"));
        lines.push("");
      });
    } else {
      lines.push("[none]");
      lines.push("");
    }
    lines.push("Raw Step Prompt:");
    lines.push(formatTextBlock(step.systemPrompt, "[empty]"));
  });

  return `${lines.join("\n")}\n`;
}

async function writePipelineDebugFile(debugRun) {
  await ensureDirectories();
  const fileName = `${slugify(debugRun.chatId || "chat")}-${formatIsoTimestampForFile(
    debugRun.startedAt
  )}-pipeline.txt`;
  await fs.writeFile(
    path.join(PIPELINE_DEBUG_DIR, fileName),
    buildPipelineDebugText(debugRun),
    "utf8"
  );
}

async function writeLatestEventChainFile(eventChainText) {
  await ensureDirectories();
  await fs.appendFile(
    EVENT_CHAIN_DUMP_PATH,
    `${String(eventChainText || "").trim()}\n\n`,
    "utf8"
  );
}

async function requestRoleCompletion(roleConfig, systemPrompt, conversationMessages) {
  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => {
    abortController.abort(
      new Error(`OpenRouter request timed out after ${OPENROUTER_REQUEST_TIMEOUT_MS}ms.`)
    );
  }, OPENROUTER_REQUEST_TIMEOUT_MS);

  let openRouterResponse;
  try {
    openRouterResponse = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: roleConfig.llm,
          temperature: Number(roleConfig.temperature),
          top_p: Number(roleConfig.topP),
          max_tokens: Number(roleConfig.maxTokens),
          messages: buildRoleRequestMessages(systemPrompt, conversationMessages),
        }),
        signal: abortController.signal,
      }
    );
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(
        `OpenRouter request timed out after ${OPENROUTER_REQUEST_TIMEOUT_MS}ms.`
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }

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
  return String(rawOutput || "").trim();
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

function resolvePipelineInput(outputKey, currentOutputs, previousHiddenState, characters) {
  const currentValue = String(currentOutputs?.[outputKey] || "").trim();
  if (currentValue) {
    return {
      value: currentValue,
      source: "current run output",
    };
  }

  const previousValue = String(previousHiddenState?.[outputKey] || "").trim();
  if (previousValue) {
    return {
      value: previousValue,
      source: "previous hidden state fallback",
    };
  }

  return {
    value: "",
    source: "missing",
  };
}

function getPipelineInputValue(outputKey, currentOutputs, previousHiddenState, characters) {
  return resolvePipelineInput(outputKey, currentOutputs, previousHiddenState, characters).value;
}

function buildPipelineInputData(stepName, stepConfig, runtimeState) {
  const sections = [];
  const resolvedInputs = [];

  if (stepConfig?.includeCharacterCards) {
    sections.push(`Chat characters:\n${runtimeState.characterRosterPrompt}`);
  }

  (stepConfig?.previousOutputs || []).forEach((outputKey) => {
    const label = PIPELINE_OUTPUT_LABELS[outputKey] || outputKey;
    const resolved = resolvePipelineInput(
      outputKey,
      runtimeState.currentOutputs,
      runtimeState.previousHiddenState,
      runtimeState.chatCharacters
    );
    if (!String(resolved.value || "").trim()) {
      return;
    }
    sections.push(`${label}:\n${resolved.value}`);
    resolvedInputs.push({
      outputKey,
      label,
      value: resolved.value,
      source: resolved.source,
    });
  });

  return {
    sections,
    resolvedInputs,
  };
}

function getPipelineMessages(stepName, messageWindow, draftMessages) {
  const messages = Array.isArray(draftMessages) ? draftMessages : [];
  if (messages.length === 0) {
    return [{ role: "user", content: "" }];
  }

  const normalizedWindow = Number(messageWindow);
  if (!Number.isFinite(normalizedWindow) || normalizedWindow <= 0) {
    return messages;
  }

  const count = Math.max(1, Math.floor(normalizedWindow));
  if (count >= messages.length) {
    return messages;
  }

  return messages.slice(-count);
}

async function executePipelineStep(stepName, runtimeState) {
  const stepConfig = runtimeState.pipeline?.steps?.[stepName];
  if (!stepConfig) {
    throw new Error(`No pipeline inputs configured for step "${stepName}".`);
  }

  const inputData = buildPipelineInputData(stepName, stepConfig, runtimeState);
  const inputSections = inputData.sections;
  const inputMessages = getPipelineMessages(
    stepName,
    stepConfig.messageWindow,
    runtimeState.draftMessages
  );
  const requestMessages = inputSections.length
    ? [{ role: "user", content: inputSections.join("\n\n") }, ...inputMessages]
    : inputMessages;
  const normalizedWindow = Number(stepConfig.messageWindow);
  const windowCount = Math.max(1, Math.floor(normalizedWindow || 1));
  const messageWindowLabel = !Number.isFinite(normalizedWindow) || normalizedWindow <= 0
    ? "all visible messages (invalid or disabled window)"
    : windowCount >= runtimeState.draftMessages.length
      ? "all visible messages"
      : `latest ${windowCount} visible messages`;

  switch (stepName) {
    case "continuity": {
      const role = runtimeState.roles.continuity;
      const systemPrompt = role.instructions || "";
      const output = await requestRoleCompletion(role, systemPrompt, requestMessages);
      return {
        stepName,
        outputKey: PIPELINE_OUTPUT_KEYS[stepName],
        output,
        model: role.llm || null,
        inputMessages: requestMessages,
        debug: {
          stepName,
          outputKey: PIPELINE_OUTPUT_KEYS[stepName],
          model: role.llm || null,
          messageWindowLabel,
          includeCharacterCards: Boolean(stepConfig.includeCharacterCards),
          previousOutputsRequested: [...(stepConfig.previousOutputs || [])],
          resolvedInputs: inputData.resolvedInputs,
          inputMessages: requestMessages,
          systemPrompt,
        },
      };
    }
    case "event": {
      const role = runtimeState.roles.event;
      const systemPrompt = role.instructions || "";
      const output = await requestRoleCompletion(role, systemPrompt, requestMessages);
      return {
        stepName,
        outputKey: PIPELINE_OUTPUT_KEYS[stepName],
        output,
        model: role.llm || null,
        inputMessages: requestMessages,
        debug: {
          stepName,
          outputKey: PIPELINE_OUTPUT_KEYS[stepName],
          model: role.llm || null,
          messageWindowLabel,
          includeCharacterCards: Boolean(stepConfig.includeCharacterCards),
          previousOutputsRequested: [...(stepConfig.previousOutputs || [])],
          resolvedInputs: inputData.resolvedInputs,
          inputMessages: requestMessages,
          systemPrompt,
        },
      };
    }
    case "mind": {
      const role = runtimeState.roles.mind;
      const systemPrompt = role.instructions || "";
      const rawOutput = await requestRoleCompletion(role, systemPrompt, requestMessages);
      const output = await normalizeMindOutput(
        role,
        runtimeState.chatCharacters,
        rawOutput,
        getPipelineInputValue(
          "mindOutput",
          runtimeState.currentOutputs,
          runtimeState.previousHiddenState,
          runtimeState.chatCharacters
        )
      );
      return {
        stepName,
        outputKey: PIPELINE_OUTPUT_KEYS[stepName],
        output,
        model: role.llm || null,
        inputMessages: requestMessages,
        debug: {
          stepName,
          outputKey: PIPELINE_OUTPUT_KEYS[stepName],
          model: role.llm || null,
          messageWindowLabel,
          includeCharacterCards: Boolean(stepConfig.includeCharacterCards),
          previousOutputsRequested: [...(stepConfig.previousOutputs || [])],
          resolvedInputs: inputData.resolvedInputs,
          inputMessages: requestMessages,
          systemPrompt,
        },
      };
    }
    case "goal": {
      const role = runtimeState.roles.goal;
      const systemPrompt = role.instructions || "";
      const rawOutput = await requestRoleCompletion(role, systemPrompt, requestMessages);
      const output = normalizeGoalRosterOutput(
        runtimeState.chatCharacters,
        rawOutput,
        getPipelineInputValue(
          "goalOutput",
          runtimeState.currentOutputs,
          runtimeState.previousHiddenState,
          runtimeState.chatCharacters
        )
      );
      return {
        stepName,
        outputKey: PIPELINE_OUTPUT_KEYS[stepName],
        output,
        model: role.llm || null,
        inputMessages: requestMessages,
        debug: {
          stepName,
          outputKey: PIPELINE_OUTPUT_KEYS[stepName],
          model: role.llm || null,
          messageWindowLabel,
          includeCharacterCards: Boolean(stepConfig.includeCharacterCards),
          previousOutputsRequested: [...(stepConfig.previousOutputs || [])],
          resolvedInputs: inputData.resolvedInputs,
          inputMessages: requestMessages,
          systemPrompt,
        },
      };
    }
    case "stat": {
      const role = runtimeState.roles.stat;
      const systemPrompt = role.instructions || "";
      const rawOutput = await requestRoleCompletion(role, systemPrompt, requestMessages);
      const output = normalizeRelationshipStatsRosterOutput(
        runtimeState.chatCharacters,
        rawOutput,
        getPipelineInputValue(
          "statOutput",
          runtimeState.currentOutputs,
          runtimeState.previousHiddenState,
          runtimeState.chatCharacters
        )
      );
      return {
        stepName,
        outputKey: PIPELINE_OUTPUT_KEYS[stepName],
        output,
        model: role.llm || null,
        inputMessages: requestMessages,
        debug: {
          stepName,
          outputKey: PIPELINE_OUTPUT_KEYS[stepName],
          model: role.llm || null,
          messageWindowLabel,
          includeCharacterCards: Boolean(stepConfig.includeCharacterCards),
          previousOutputsRequested: [...(stepConfig.previousOutputs || [])],
          resolvedInputs: inputData.resolvedInputs,
          inputMessages: requestMessages,
          systemPrompt,
        },
      };
    }
    case "author": {
      const role = runtimeState.roles.author;
      const authorModel = role.llm;
      const systemPrompt = role.instructions || "";

      const output = await requestRoleCompletion(
        {
          ...role,
          llm: authorModel,
        },
        systemPrompt,
        requestMessages
      );
      return {
        stepName,
        outputKey: PIPELINE_OUTPUT_KEYS[stepName],
        output,
        model: authorModel,
        inputMessages: requestMessages,
        debug: {
          stepName,
          outputKey: PIPELINE_OUTPUT_KEYS[stepName],
          model: authorModel,
          messageWindowLabel,
          includeCharacterCards: Boolean(stepConfig.includeCharacterCards),
          previousOutputsRequested: [...(stepConfig.previousOutputs || [])],
          resolvedInputs: inputData.resolvedInputs,
          inputMessages: requestMessages,
          systemPrompt,
        },
      };
    }
    default:
      throw new Error(`Unsupported pipeline step "${stepName}".`);
  }
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
  await fs.mkdir(PIPELINE_DEBUG_DIR, { recursive: true });
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
  const chat = normalizeChat({
    ...JSON.parse(raw),
    fileName,
  });

  if (!hasPendingRegenerationJobForChat(fileName)) {
    chat.messages = stripPendingAssistantMessages(chat.messages);
  }

  return chat;
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

function createEmptyHiddenStateOutputs(chatCharacters) {
  return {
    continuityOutput: "",
    eventOutput: "",
    mindOutput: "",
    goalOutput: "",
    statOutput: buildDefaultRelationshipStatsForCharacters(chatCharacters),
    authorOutput: "",
  };
}

function createHiddenStateOutputsFromChat(chat, chatCharacters) {
  return {
    continuityOutput: chat.hiddenState?.continuityNotes?.content || "",
    eventOutput: chat.hiddenState?.eventChain?.content || "",
    mindOutput: chat.hiddenState?.mentalSynopsis?.content || "",
    goalOutput: chat.hiddenState?.midTermGoals?.content || "",
    statOutput:
      chat.hiddenState?.relationshipStats?.content ||
      buildDefaultRelationshipStatsForCharacters(chatCharacters),
    authorOutput: chat.hiddenState?.authorScene?.content || "",
  };
}

function buildHiddenStatePayload(
  existingHiddenState,
  currentOutputs,
  currentModels,
  roles,
  previousHiddenState,
  assistantText,
  pipelineTrace
) {
  return {
    ...(existingHiddenState || {}),
    mentalSynopsis: {
      content: currentOutputs.mindOutput || previousHiddenState.mindOutput,
      updatedAt: new Date().toISOString(),
      model: currentModels.mindOutput || roles.mind.llm || "",
    },
    continuityNotes: {
      content: currentOutputs.continuityOutput || previousHiddenState.continuityOutput,
      updatedAt: new Date().toISOString(),
      model: currentModels.continuityOutput || roles.continuity.llm || "",
    },
    eventChain: {
      content: currentOutputs.eventOutput || previousHiddenState.eventOutput,
      updatedAt: new Date().toISOString(),
      model: currentModels.eventOutput || roles.event.llm || "",
    },
    midTermGoals: {
      content: currentOutputs.goalOutput || previousHiddenState.goalOutput,
      updatedAt: new Date().toISOString(),
      model: currentModels.goalOutput || roles.goal.llm || "",
    },
    relationshipStats: {
      content: currentOutputs.statOutput || previousHiddenState.statOutput,
      updatedAt: new Date().toISOString(),
      model: currentModels.statOutput || roles.stat.llm || "",
    },
    authorScene: {
      content: assistantText,
      updatedAt: new Date().toISOString(),
      model: currentModels.authorOutput || roles.author.llm || "",
    },
    pipelineTrace: {
      lastRun: pipelineTrace,
    },
  };
}

async function runPipelineForDraft({
  chat,
  chatFileName,
  character,
  chatCharacters,
  loadout,
  draftMessages,
  previousHiddenState,
  writeArtifacts = true,
}) {
  const visibleDraftMessages = stripPendingAssistantMessages(draftMessages);
  const runStartedAt = new Date().toISOString();
  const pipelineTrace = [];
  const pipelineDebugRun = {
    startedAt: runStartedAt,
    status: "running",
    chatId: chat.id,
    chatFileName: chat.fileName || chatFileName,
    loadoutName: loadout?.name || "Model Loadout 1",
    pipelineOrder: [],
    steps: [],
    errorMessage: "",
  };
  const traceStep = (step, model, extra = {}) => {
    pipelineTrace.push({
      step,
      model: model || null,
      at: new Date().toISOString(),
      ...extra,
    });
  };

  const roles = {
    continuity: loadout?.roles?.continuity || defaultLoadouts[0].roles.continuity,
    event: loadout?.roles?.event || defaultLoadouts[0].roles.event,
    mind: loadout?.roles?.mind || defaultLoadouts[0].roles.mind,
    goal: loadout?.roles?.goal || defaultLoadouts[0].roles.goal,
    stat: loadout?.roles?.stat || defaultLoadouts[0].roles.stat,
    author: loadout?.roles?.author || defaultLoadouts[0].roles.author,
  };
  const pipeline = sanitizePipeline(loadout?.pipeline);
  const characterRosterPrompt = formatCharactersForPrompt(chatCharacters);
  const currentOutputs = {};
  const currentModels = {};
  const latestUserMessage = [...visibleDraftMessages].reverse().find(
    (message) => message.role === "user"
  );

  pipelineDebugRun.pipelineOrder = [...pipeline.order];

  traceStep("user_message_added", null, {
    messageId: latestUserMessage?.id || "",
    visibleMessageCount: visibleDraftMessages.length,
  });

  if (!pipeline.order.includes("author")) {
    throw new Error('Loadout pipeline must include "author".');
  }

  try {
    for (const stepName of pipeline.order) {
      const result = await executePipelineStep(stepName, {
        character,
        chatCharacters,
        draftMessages: visibleDraftMessages,
        characterRosterPrompt,
        previousHiddenState,
        currentOutputs,
        roles,
        pipeline,
      });

      currentOutputs[result.outputKey] = result.output;
      currentModels[result.outputKey] = result.model;
      pipelineDebugRun.steps.push(result.debug);

      if (writeArtifacts && result.outputKey === "eventOutput") {
        await writeLatestEventChainFile(result.output);
      }

      traceStep(PIPELINE_TRACE_LABELS[result.stepName] || `${result.stepName}_completed`, result.model, {
        inputMessages: result.inputMessages.length,
      });
    }

    const assistantText = currentOutputs.authorOutput || "";
    const assistantMessage = {
      id: makeId("msg"),
      role: "assistant",
      content: assistantText,
      createdAt: new Date().toISOString(),
    };

    traceStep("author_message_added", null, {
      messageId: assistantMessage.id,
      visibleMessageCount: visibleDraftMessages.length + 1,
    });

    pipelineDebugRun.status = "completed";

    return {
      roles,
      pipelineTrace,
      currentOutputs,
      currentModels,
      assistantText,
      assistantMessage,
    };
  } catch (error) {
    pipelineDebugRun.status = "failed";
    pipelineDebugRun.errorMessage =
      error instanceof Error ? error.message : "Unknown pipeline error.";
    throw error;
  } finally {
    if (writeArtifacts) {
      try {
        await writePipelineDebugFile(pipelineDebugRun);
      } catch (debugError) {
        console.error(
          "Failed to write pipeline debug file:",
          debugError instanceof Error ? debugError.message : debugError
        );
      }
    }
  }
}

async function rebuildHiddenStateBeforeMessage(chat, messagesBeforeEdit, character, chatCharacters, loadout) {
  let previousHiddenState = createEmptyHiddenStateOutputs(chatCharacters);
  const replayMessages = [];

  for (let index = 0; index < messagesBeforeEdit.length; index += 1) {
    const message = messagesBeforeEdit[index];
    replayMessages.push(message);

    if (message.role !== "user") {
      continue;
    }

    const result = await runPipelineForDraft({
      chat,
      chatFileName: chat.fileName,
      character,
      chatCharacters,
      loadout,
      draftMessages: [...replayMessages],
      previousHiddenState,
      writeArtifacts: false,
    });

    const nextAssistantMessage = messagesBeforeEdit[index + 1];
    previousHiddenState = {
      continuityOutput: result.currentOutputs.continuityOutput || previousHiddenState.continuityOutput,
      eventOutput: result.currentOutputs.eventOutput || previousHiddenState.eventOutput,
      mindOutput: result.currentOutputs.mindOutput || previousHiddenState.mindOutput,
      goalOutput: result.currentOutputs.goalOutput || previousHiddenState.goalOutput,
      statOutput: result.currentOutputs.statOutput || previousHiddenState.statOutput,
      authorOutput:
        nextAssistantMessage?.role === "assistant"
          ? nextAssistantMessage.content
          : result.assistantText || previousHiddenState.authorOutput,
    };
  }

  return previousHiddenState;
}

function countUserTurns(messages) {
  if (!Array.isArray(messages)) {
    return 0;
  }

  return messages.reduce(
    (count, message) => count + (message?.role === "user" ? 1 : 0),
    0
  );
}

function buildFastEditReplayFallback(chat, messagesBeforeEdit, chatCharacters) {
  const fallbackState = createHiddenStateOutputsFromChat(chat, chatCharacters);
  const previousAssistantMessage = [...messagesBeforeEdit]
    .reverse()
    .find((message) => message?.role === "assistant");

  return {
    ...fallbackState,
    authorOutput: previousAssistantMessage?.content || "",
  };
}

function withTimeout(promise, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeoutHandle);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutHandle);
        reject(error);
      }
    );
  });
}

async function resolvePreviousHiddenStateForEdit(
  chat,
  messagesBeforeEdit,
  character,
  chatCharacters,
  loadout
) {
  if (!messagesBeforeEdit.length) {
    return createEmptyHiddenStateOutputs(chatCharacters);
  }

  const userTurnCount = countUserTurns(messagesBeforeEdit);
  if (userTurnCount > EDIT_REGEN_REPLAY_USER_TURN_LIMIT) {
    return buildFastEditReplayFallback(chat, messagesBeforeEdit, chatCharacters);
  }

  try {
    return await withTimeout(
      rebuildHiddenStateBeforeMessage(
        chat,
        messagesBeforeEdit,
        character,
        chatCharacters,
        loadout
      ),
      EDIT_REGEN_REPLAY_TIMEOUT_MS,
      "Hidden-state replay"
    );
  } catch (error) {
    console.warn(
      `Falling back to fast edit replay state for ${chat.fileName || chat.id}:`,
      error instanceof Error ? error.message : error
    );
    return buildFastEditReplayFallback(chat, messagesBeforeEdit, chatCharacters);
  }
}

async function saveChatMessage(chatFileName, content) {
  const chat = await loadChat(chatFileName);
  if (hasPendingRegenerationJobForChat(chatFileName)) {
    throw new Error("Wait for the current regeneration to finish.");
  }
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

  const draftMessages = [...stripPendingAssistantMessages(chat.messages || []), userMessage];
  const nextTitle =
    chat.title === "New Chat" ? summarizeTitle(userMessage.content) : chat.title;
  const previousHiddenState = createHiddenStateOutputsFromChat(chat, chatCharacters);

  await saveChat({
    ...chat,
    title: nextTitle,
    characterName: character.name,
    updatedAt: new Date().toISOString(),
    hiddenState: {
      ...(chat.hiddenState || {}),
      pipelineTrace: {
        lastRun: [],
      },
    },
    messages: draftMessages,
  });

  try {
    const result = await runPipelineForDraft({
      chat,
      chatFileName,
      character,
      chatCharacters,
      loadout,
      draftMessages,
      previousHiddenState,
      writeArtifacts: true,
    });

    return saveChat({
      ...chat,
      title: nextTitle,
      characterName: character.name,
      updatedAt: new Date().toISOString(),
      hiddenState: buildHiddenStatePayload(
        chat.hiddenState,
        result.currentOutputs,
        result.currentModels,
        result.roles,
        previousHiddenState,
        result.assistantText,
        result.pipelineTrace
      ),
      messages: [...draftMessages, result.assistantMessage],
    });
  } catch (error) {
    throw error;
  }
}

async function editLastUserMessageAndRegenerate(chatFileName, messageId, content) {
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

  const editedContent = String(content || "").trim();
  if (!editedContent) {
    throw new Error("Message content is empty.");
  }

  const messages = stripPendingAssistantMessages(chat.messages || []);
  const targetIndex = messages.findIndex((entry) => entry.id === messageId);
  if (targetIndex < 0) {
    throw new Error("Message not found in this chat.");
  }
  if (messages[targetIndex]?.role !== "user") {
    throw new Error("Only user messages can be regenerated.");
  }
  const isLatestUserWithoutReply = targetIndex === messages.length - 1;
  const isLastCompletedTurn =
    targetIndex === messages.length - 2 && messages.at(-1)?.role === "assistant";
  if (!isLatestUserWithoutReply && !isLastCompletedTurn) {
    throw new Error("Only the most recent user message can be edited and regenerated.");
  }

  const messagesBeforeEdit = messages.slice(0, targetIndex);
  const editedUserMessage = {
    ...messages[targetIndex],
    content: editedContent,
  };
  const draftMessages = [...messagesBeforeEdit, editedUserMessage];
  const nextTitle =
    chat.title === "New Chat" ? summarizeTitle(editedUserMessage.content) : chat.title;

  const pendingAssistantMessage = {
    id: `pending-regeneration-${messageId}-${Date.now()}`,
    role: "assistant",
    content: "Regenerating response...",
    createdAt: new Date().toISOString(),
    pending: true,
  };
  const pendingChat = await saveChat({
    ...chat,
    title: nextTitle,
    characterName: character.name,
    updatedAt: new Date().toISOString(),
    messages: [...draftMessages, pendingAssistantMessage],
  });

  const jobKey = `${chatFileName}:${messageId}`;
  const requestId = makeId("regen");
  pendingRegenerationJobs.set(jobKey, { requestId });

  void (async () => {
    try {
      const previousHiddenState = await resolvePreviousHiddenStateForEdit(
        chat,
        messagesBeforeEdit,
        character,
        chatCharacters,
        loadout
      );
      const result = await runPipelineForDraft({
        chat,
        chatFileName,
        character,
        chatCharacters,
        loadout,
        draftMessages,
        previousHiddenState,
        writeArtifacts: true,
      });

      if (!isLatestPendingRegeneration(jobKey, requestId)) {
        return;
      }

      await saveChat({
        ...pendingChat,
        title: nextTitle,
        characterName: character.name,
        updatedAt: new Date().toISOString(),
        hiddenState: buildHiddenStatePayload(
          chat.hiddenState,
          result.currentOutputs,
          result.currentModels,
          result.roles,
          previousHiddenState,
          result.assistantText,
          result.pipelineTrace
        ),
        messages: [...draftMessages, result.assistantMessage],
      });
    } catch (error) {
      if (!isLatestPendingRegeneration(jobKey, requestId)) {
        return;
      }

      const latestChat = await loadChat(chatFileName).catch(() => pendingChat);
      const latestMessages = Array.isArray(latestChat?.messages)
        ? [...latestChat.messages]
        : [...pendingChat.messages];
      const pendingIndex = latestMessages.findIndex(
        (entry) => entry.id === pendingAssistantMessage.id
      );
      if (pendingIndex >= 0) {
        latestMessages[pendingIndex] = {
          ...latestMessages[pendingIndex],
          content: `Regeneration failed: ${error.message || "Unknown error."}`,
          pending: false,
          error: true,
        };
      }

      await saveChat({
        ...latestChat,
        title: nextTitle,
        characterName: character.name,
        updatedAt: new Date().toISOString(),
        messages: latestMessages,
      });
    } finally {
      if (isLatestPendingRegeneration(jobKey, requestId)) {
        pendingRegenerationJobs.delete(jobKey);
      }
    }
  })();

  return pendingChat;
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

    if (request.method === "POST" && url.pathname === "/api/chats/edit-last-user-and-regenerate") {
      const body = JSON.parse((await readRequestBody(request)) || "{}");
      const chat = await editLastUserMessageAndRegenerate(
        body.chatFileName,
        body.messageId,
        body.content
      );
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
  console.log(`Pipeline debug directory: ${PIPELINE_DEBUG_DIR}`);
  console.log(`Author model: ${OPENROUTER_AUTHOR_MODEL}`);
});
