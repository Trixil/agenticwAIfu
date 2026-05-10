const DEFAULT_CHARACTER_IMAGE = "assets/character-1.png";
const API_BASE = "http://127.0.0.1:4317/api";

const pageType = document.body.dataset.page || "home";

const overlays = Array.from(document.querySelectorAll(".editor-overlay"));
const defaultSurface = document.getElementById("default-surface");

const chatList = document.getElementById("chat-list");
const chatTitle = document.getElementById("chat-title");
const chatWindow = document.getElementById("chat-window");
const chatCharacterSubtitle = document.getElementById("chat-character-subtitle");
const composerInput = document.getElementById("composer-input");
const sendMessageButton = document.getElementById("send-message-button");

const roleButtons = Array.from(document.querySelectorAll("[data-role-select]"));
const roleTitle = document.getElementById("loadout-role-title");
const loadoutTitleInput = document.getElementById("editor-loadout-title");
const roleLlm = document.getElementById("editor-role-llm");
const roleTemperature = document.getElementById("editor-temperature");
const roleTopP = document.getElementById("editor-top-p");
const roleMaxTokens = document.getElementById("editor-max-tokens");
const roleInstructions = document.getElementById("editor-role-instructions");
const loadoutRoleFields = document.getElementById("loadout-role-fields");
const loadoutPipelineEditor = document.getElementById("loadout-pipeline-editor");
const pipelineOrderList = document.getElementById("pipeline-order-list");
const pipelineStepTitle = document.getElementById("pipeline-step-title");
const pipelineStepCopy = document.getElementById("pipeline-step-copy");
const pipelineOutputList = document.getElementById("pipeline-output-list");
const pipelineMessageWindowInput = document.getElementById("pipeline-message-window");
const pipelineIncludeCharacterCardsInput = document.getElementById(
  "pipeline-include-character-cards"
);
const loadoutSelect = document.getElementById("loadout-select");
const newLoadoutButton = document.getElementById("new-loadout-button");
const saveLoadoutButton = document.getElementById("save-loadout-button");
const deleteLoadoutButton = document.getElementById("delete-loadout-button");
const loadoutFileStatus = document.getElementById("loadout-file-status");
const selectedLoadoutButton = document.getElementById("selected-loadout-button");
const selectedLoadoutName = document.getElementById("selected-loadout-name");
const loadoutSwitchMenu = document.getElementById("loadout-switch-menu");

const characterTileGrid = document.getElementById("character-tile-grid");
const saveCharacterButton = document.getElementById("save-character-button");
const deleteCharacterButton = document.getElementById("delete-character-button");
const characterFileStatus = document.getElementById("character-file-status");
const characterDetailTitle = document.getElementById("character-detail-title");
const characterNameInput = document.getElementById("editor-character-name");
const characterNicknameInput = document.getElementById("editor-character-nickname");
const characterImageFileInput = document.getElementById("editor-character-image-file");
const characterPortraitPreview = document.getElementById(
  "editor-character-portrait-preview"
);
const characterDescriptionInput = document.getElementById(
  "editor-character-description"
);
const characterScenarioInput = document.getElementById("editor-character-scenario");
const characterDialogueInput = document.getElementById("editor-character-dialogue");

const selectedCharacterName = document.getElementById("selected-character-name");
const selectedCharacterImage = document.getElementById("selected-character-image");
const chatCharacterList = document.getElementById("chat-character-list");
const chatCharacterNote = document.getElementById("chat-character-note");
const addChatCharacterButton = document.getElementById("add-chat-character-button");
const chatCharacterAddMenu = document.getElementById("chat-character-add-menu");
const editSidebarCharacterButton = document.getElementById("edit-sidebar-character-button");

const DEFAULT_MULTI_CHARACTER_MIND_INSTRUCTIONS = `# Mind LLM System Instructions

You are the Mind LLM for a long-term interactive fiction character roster.

Your job is to update the hidden Mental Synopsis for every character currently attached to the chat after each user interaction.

Use the previous roster Mental Synopsis, the last 20 messages, the latest user input, the full chat character cards, and the current scene context.

For each character, the Mental Synopsis should describe that character's current emotional state, private reaction, and immediate short-term desire.

Do not summarize the scene mechanically. Focus on each character's inner state.

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

Your job is to maintain the hidden list of mid-term goals for every character currently attached to the chat.

Use the previous roster goal list, the updated roster Mental Synopsis, the last 5 messages, the latest user input, the full chat character cards, and the current scene context.

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

const roleData = {
  mind: {
    title: "Mind Model",
    llm: "gpt-oss-cinematic",
    temperature: "1.05",
    topP: "0.92",
    maxTokens: "4096",
    instructions: DEFAULT_MULTI_CHARACTER_MIND_INSTRUCTIONS,
  },
  author: {
    title: "Author Model",
    llm: "deepseek/deepseek-chat-v3.1",
    temperature: "0.90",
    topP: "0.95",
    maxTokens: "700",
    instructions:
      "Write the final visible in-character assistant response using the selected character's voice and the current chat context.",
  },
  continuity: {
    title: "Continuity Model",
    llm: "gpt-oss-continuity",
    temperature: "0.45",
    topP: "0.82",
    maxTokens: "1536",
    instructions:
      "Track scene continuity, relationship state, established facts, and unresolved threads so the rest of the loadout stays consistent with prior chat history.",
  },
  stat: {
    title: "Stat Model",
    llm: "gpt-oss-structured",
    temperature: "0.35",
    topP: "0.80",
    maxTokens: "1024",
    instructions: DEFAULT_MULTI_CHARACTER_STAT_INSTRUCTIONS,
  },
  event: {
    title: "Event Model",
    llm: "gpt-oss-sim",
    temperature: "0.88",
    topP: "0.90",
    maxTokens: "2048",
    instructions:
      "Resolve world events, trigger scene beats, and produce compact event summaries that the mind and author models can consume.",
  },
  goal: {
    title: "Goal Model",
    llm: "gpt-oss-planner",
    temperature: "0.64",
    topP: "0.85",
    maxTokens: "1536",
    instructions: DEFAULT_MULTI_CHARACTER_GOAL_INSTRUCTIONS,
  },
};

const PIPELINE_EDITOR_KEY = "pipeline";
const PIPELINE_STEP_ORDER = ["continuity", "event", "mind", "goal", "stat", "author"];
const PIPELINE_OUTPUT_OPTIONS = [
  { key: "continuityOutput", label: "Continuity Output" },
  { key: "eventOutput", label: "Event Output" },
  { key: "mindOutput", label: "Mind Output" },
  { key: "goalOutput", label: "Goal Output" },
  { key: "statOutput", label: "Stat Output" },
];
const PIPELINE_DEFAULTS = {
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

let characters = [];
let loadouts = [];
let chats = [];
let activeChat = null;
let selectedCharacterId = null;
let editingCharacterId = null;
let selectedLoadoutId = null;
let editingLoadoutId = null;
let characterDirectory = "";
let chatDirectory = "";
let loadoutDirectory = "";
let activeRoleKey = "mind";
let selectedPipelineStepKey = "continuity";
let draggedPipelineStepKey = null;
let suppressPipelineStepClick = false;
let isSending = false;
let isLoadoutMenuOpen = false;
let isChatCharacterMenuOpen = false;

function setStatus(message) {
  if (characterFileStatus) {
    characterFileStatus.textContent = message;
  }
}

function setLoadoutStatus(message) {
  if (loadoutFileStatus) {
    loadoutFileStatus.textContent = message;
  }
}

function makeCharacterId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `character-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function createCharacterTemplate(index = 1) {
  return {
    id: makeCharacterId(),
    name: `Character ${index}`,
    nickname: `Character ${index}`,
    image: DEFAULT_CHARACTER_IMAGE,
    description: "",
    scenario: "",
    dialogue: "",
    fileName: null,
  };
}

function createLoadoutTemplate(index = 1) {
  return {
    id: `loadout-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    name: `Model Loadout ${index}`,
    fileName: null,
    roles: JSON.parse(JSON.stringify(roleData)),
    pipeline: createDefaultPipelineConfig(),
  };
}

function createDefaultPipelineConfig() {
  return JSON.parse(JSON.stringify(PIPELINE_DEFAULTS));
}

function normalizePipelineStep(stepConfig, fallbackStep) {
  const rawPreviousOutputs = Array.isArray(stepConfig?.previousOutputs)
    ? stepConfig.previousOutputs
    : fallbackStep.previousOutputs;
  const previousOutputs = rawPreviousOutputs
    .map((value) => String(value || "").trim())
    .filter((value) => PIPELINE_OUTPUT_OPTIONS.some((option) => option.key === value));
  const messageWindow = Number(stepConfig?.messageWindow);

  return {
    previousOutputs: [...new Set(previousOutputs)],
    messageWindow:
      Number.isFinite(messageWindow) && messageWindow > 0
        ? Math.floor(messageWindow)
        : fallbackStep.messageWindow,
    includeCharacterCards:
      typeof stepConfig?.includeCharacterCards === "boolean"
        ? stepConfig.includeCharacterCards
        : fallbackStep.includeCharacterCards,
  };
}

function normalizePipelineConfig(pipeline) {
  const fallback = createDefaultPipelineConfig();
  const requestedOrder = Array.isArray(pipeline?.order) ? pipeline.order : fallback.order;
  const normalizedNonAuthor = requestedOrder
    .map((value) => String(value || "").trim())
    .filter((value) => PIPELINE_STEP_ORDER.includes(value) && value !== "author");
  const defaultNonAuthor = fallback.order.filter((step) => step !== "author");
  const order = [
    ...new Set([
      ...normalizedNonAuthor,
      ...defaultNonAuthor.filter((step) => !normalizedNonAuthor.includes(step)),
    ]),
    "author",
  ];

  return {
    order,
    steps: Object.fromEntries(
      order.map((stepKey) => [
        stepKey,
        normalizePipelineStep(pipeline?.steps?.[stepKey], fallback.steps[stepKey]),
      ])
    ),
  };
}

function syncPipelineConfigInPlace(loadout) {
  if (!loadout?.pipeline) {
    return;
  }

  const normalized = normalizePipelineConfig(loadout.pipeline);
  loadout.pipeline.order = normalized.order;
  loadout.pipeline.steps = normalized.steps;
}

function normalizeRoleConfig(roleKey, role) {
  const fallback = roleData[roleKey];
  return {
    llm: role?.llm ?? fallback.llm,
    temperature: role?.temperature ?? fallback.temperature,
    topP: role?.topP ?? fallback.topP,
    maxTokens: role?.maxTokens ?? fallback.maxTokens,
    instructions: role?.instructions ?? fallback.instructions,
  };
}

function normalizeCharacter(character) {
  return {
    id: character?.id || makeCharacterId(),
    name: (character?.name || "Untitled Character").trim(),
    nickname: (character?.nickname || character?.name || "Character").trim(),
    image: (character?.image || DEFAULT_CHARACTER_IMAGE).trim(),
    description: character?.description ?? "",
    scenario: character?.scenario ?? "",
    dialogue: character?.dialogue ?? "",
    fileName: character?.fileName || null,
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

function normalizeChatRecord(chat) {
  const characterIds = getChatCharacterIds(chat);
  const primaryCharacterId = characterIds[0] || null;
  const resolvedNames = characterIds
    .map((characterId) => getCharacterById(characterId)?.name)
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

function getCharacterById(id) {
  return characters.find((character) => character.id === id) || null;
}

function getLoadoutById(id) {
  return loadouts.find((loadout) => loadout.id === id) || null;
}

function getSelectedCharacter() {
  return getCharacterById(selectedCharacterId);
}

function getEditingCharacter() {
  return getCharacterById(editingCharacterId);
}

function getCharacterDisplayName(character) {
  return character?.nickname?.trim() || character?.name?.trim() || "Character";
}

function getCharacterImage(character) {
  return character?.image?.trim() || DEFAULT_CHARACTER_IMAGE;
}

function getPrimaryActiveChatCharacter() {
  return activeChat ? getCharacterById(activeChat.characterId) : null;
}

function getSidebarCharacter() {
  if (pageType !== "chat") {
    return getSelectedCharacter();
  }

  const activeIds = activeChat ? getChatCharacterIds(activeChat) : [];
  if (selectedCharacterId && activeIds.includes(selectedCharacterId)) {
    return getCharacterById(selectedCharacterId);
  }

  return getPrimaryActiveChatCharacter() || getSelectedCharacter();
}

function formatChatCharacterSubtitle(chat) {
  const normalizedChat = normalizeChatRecord(chat);
  const primaryCharacter = getCharacterById(normalizedChat.characterId);
  const primaryLabel = getCharacterDisplayName(primaryCharacter);
  const additionalCount = Math.max(0, normalizedChat.characterIds.length - 1);

  if (!primaryCharacter && additionalCount === 0) {
    return "No Character";
  }

  if (additionalCount === 0) {
    return primaryLabel;
  }

  return `${primaryLabel} + ${additionalCount} more`;
}

function getSelectedLoadout() {
  return getLoadoutById(selectedLoadoutId);
}

function getEditingLoadout() {
  return getLoadoutById(editingLoadoutId);
}

function getPipelineStepLabel(stepKey) {
  if (stepKey === "author") {
    return "Author Model";
  }
  return roleData[stepKey]?.title || stepKey;
}

function getPipelineOutputLabel(outputKey) {
  return (
    PIPELINE_OUTPUT_OPTIONS.find((option) => option.key === outputKey)?.label ||
    outputKey
  );
}

function ensureSelectedPipelineStep(loadout) {
  const effectiveLoadout = loadout || getEditingLoadout();
  const availableSteps = effectiveLoadout?.pipeline?.order || PIPELINE_DEFAULTS.order;
  if (!selectedPipelineStepKey || !availableSteps.includes(selectedPipelineStepKey)) {
    selectedPipelineStepKey = availableSteps[0] || "continuity";
  }
  return selectedPipelineStepKey;
}

function summarizePipelineStep(stepKey, stepConfig) {
  const outputs = (stepConfig?.previousOutputs || []).map(getPipelineOutputLabel);
  const outputsLabel = outputs.length > 0 ? outputs.join(", ") : "No previous outputs";
  const messageLabel =
    Number(stepConfig?.messageWindow) >= 999999
      ? "All visible messages"
      : `${stepConfig?.messageWindow || 1} messages`;
  const characterCardsLabel = stepConfig?.includeCharacterCards
    ? "Character cards on"
    : "Character cards off";
  return `${outputsLabel} | ${messageLabel} | ${characterCardsLabel}`;
}

function applyCharacterImage(img, source, altText) {
  if (!img) {
    return;
  }

  img.src = source;
  img.alt = altText;
  img.onerror = () => {
    if (img.src.endsWith(DEFAULT_CHARACTER_IMAGE)) {
      return;
    }
    img.onerror = null;
    img.src = DEFAULT_CHARACTER_IMAGE;
  };
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Request failed.");
  }

  return response.json();
}

function formatChatMeta(chat) {
  const updated = new Date(chat.updatedAt);
  const now = new Date();
  const sameDay =
    updated.getFullYear() === now.getFullYear() &&
    updated.getMonth() === now.getMonth() &&
    updated.getDate() === now.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    updated.getFullYear() === yesterday.getFullYear() &&
    updated.getMonth() === yesterday.getMonth() &&
    updated.getDate() === yesterday.getDate();

  let dayLabel = updated.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  if (sameDay) {
    dayLabel = "Today";
  } else if (isYesterday) {
    dayLabel = "Yesterday";
  }

  return `${dayLabel} | ${chat.messageCount} message${chat.messageCount === 1 ? "" : "s"}`;
}

function updateCharacterTitles(nameValue) {
  const title = nameValue.trim() || "Untitled Character";
  if (characterDetailTitle) {
    characterDetailTitle.textContent = title;
  }
}

function fillCharacterForm(character) {
  if (!character || !characterNameInput) {
    return;
  }

  editingCharacterId = character.id;
  characterNameInput.value = character.name;
  characterNicknameInput.value = character.nickname;
  characterDescriptionInput.value = character.description;
  if (characterScenarioInput) {
    characterScenarioInput.value = character.scenario || "";
  }
  characterDialogueInput.value = character.dialogue;
  updateCharacterTitles(character.name);
  applyCharacterImage(
    characterPortraitPreview,
    getCharacterImage(character),
    `${character.name} portrait preview`
  );
  if (characterImageFileInput) {
    characterImageFileInput.value = "";
  }
}

function readCharacterForm() {
  const current = getEditingCharacter();
  const name = characterNameInput.value.trim() || "Untitled Character";
  const nickname = characterNicknameInput.value.trim() || name;

  return {
    name,
    nickname,
    image: current?.image?.trim() || DEFAULT_CHARACTER_IMAGE,
    description: characterDescriptionInput.value,
    scenario: characterScenarioInput?.value || "",
    dialogue: characterDialogueInput.value,
  };
}

function normalizeLoadout(loadout) {
  const fallback = createLoadoutTemplate(1);
  return {
    id: loadout?.id || fallback.id,
    name: (loadout?.name || fallback.name).trim(),
    fileName: loadout?.fileName || null,
    roles: {
      mind: normalizeRoleConfig("mind", loadout?.roles?.mind),
      author: normalizeRoleConfig("author", loadout?.roles?.author),
      continuity: normalizeRoleConfig("continuity", loadout?.roles?.continuity),
      stat: normalizeRoleConfig("stat", loadout?.roles?.stat),
      event: normalizeRoleConfig("event", loadout?.roles?.event),
      goal: normalizeRoleConfig("goal", loadout?.roles?.goal),
    },
    pipeline: normalizePipelineConfig(loadout?.pipeline),
  };
}

function syncCharacterUI() {
  const sidebarCharacter = getSidebarCharacter();
  const displayName = getCharacterDisplayName(sidebarCharacter);
  const image = getCharacterImage(sidebarCharacter);

  if (selectedCharacterName) {
    const isLead =
      pageType === "chat" &&
      activeChat &&
      sidebarCharacter &&
      sidebarCharacter.id === activeChat.characterId;
    selectedCharacterName.textContent = sidebarCharacter
      ? `${sidebarCharacter.name}${isLead ? " (Lead)" : ""}`
      : "No Character";
  }
  if (chatCharacterSubtitle) {
    chatCharacterSubtitle.textContent =
      pageType === "chat" ? formatChatCharacterSubtitle(activeChat) : sidebarCharacter ? displayName : "No Character";
  }
  applyCharacterImage(
    selectedCharacterImage,
    image,
    sidebarCharacter ? `${sidebarCharacter.name} portrait` : "Character portrait"
  );
  if (chatCharacterNote) {
    chatCharacterNote.textContent = activeChat
      ? "The first attached character remains the active responder for now."
      : "Open a chat to manage which saved characters are attached to it.";
  }
  if (addChatCharacterButton) {
    addChatCharacterButton.disabled = pageType === "chat" && !activeChat;
  }
  if (pageType === "chat" && !activeChat) {
    setChatCharacterMenuOpen(false);
  }
  renderChatCharacterList();
  renderChatCharacterAddMenu();
}

function syncLoadoutUI() {
  const loadout = getSelectedLoadout();
  if (selectedLoadoutName) {
    selectedLoadoutName.textContent = loadout?.name || "No Loadout";
  }
  renderLoadoutSwitchMenu();
}

function renderLoadoutSelect() {
  if (!loadoutSelect) {
    return;
  }

  loadoutSelect.innerHTML = "";
  loadouts.forEach((loadout) => {
    const option = document.createElement("option");
    option.value = loadout.id;
    option.textContent = loadout.name;
    option.selected = loadout.id === editingLoadoutId;
    loadoutSelect.appendChild(option);
  });
}

function movePipelineStep(loadout, draggedStepKey, targetStepKey) {
  if (!loadout?.pipeline || !draggedStepKey || draggedStepKey === "author") {
    return;
  }

  const currentOrder = loadout.pipeline.order.filter((stepKey) => stepKey !== "author");
  if (!currentOrder.includes(draggedStepKey)) {
    return;
  }

  const targetIsAuthor = targetStepKey === "author";
  const nextOrder = currentOrder.filter((stepKey) => stepKey !== draggedStepKey);
  const targetIndex = targetIsAuthor
    ? nextOrder.length
    : Math.max(0, nextOrder.indexOf(targetStepKey));

  nextOrder.splice(targetIndex, 0, draggedStepKey);
  loadout.pipeline.order = [...nextOrder, "author"];
  syncPipelineConfigInPlace(loadout);
}

function setPipelineDragStep(event, stepKey) {
  draggedPipelineStepKey = stepKey;
  suppressPipelineStepClick = false;

  const dataTransfer = event?.dataTransfer;
  if (!dataTransfer) {
    return;
  }

  dataTransfer.effectAllowed = "move";
  try {
    dataTransfer.setData("text/plain", stepKey);
  } catch (error) {
    // Some browsers block custom drag payloads for local contexts.
  }
}

function getDraggedPipelineStep(event) {
  if (draggedPipelineStepKey) {
    return draggedPipelineStepKey;
  }

  const rawValue = event?.dataTransfer?.getData("text/plain");
  const stepKey = String(rawValue || "").trim();
  if (!PIPELINE_STEP_ORDER.includes(stepKey) || stepKey === "author") {
    return null;
  }

  return stepKey;
}

function clearPipelineDragState() {
  draggedPipelineStepKey = null;
  if (!pipelineOrderList) {
    return;
  }

  Array.from(pipelineOrderList.children).forEach((child) =>
    child.classList.remove("is-drop-target", "is-dragging")
  );
}

function renderPipelineOrderList() {
  if (!pipelineOrderList) {
    return;
  }

  pipelineOrderList.innerHTML = "";
  const loadout = getEditingLoadout();
  if (!loadout?.pipeline) {
    return;
  }

  ensureSelectedPipelineStep(loadout);

  loadout.pipeline.order.forEach((stepKey) => {
    const stepConfig = loadout.pipeline.steps[stepKey];
    const card = document.createElement("button");
    card.type = "button";
    card.className = "pipeline-step-card";
    if (selectedPipelineStepKey === stepKey) {
      card.classList.add("is-selected");
    }

    const isAuthor = stepKey === "author";
    if (isAuthor) {
      card.classList.add("is-locked");
    } else {
      card.draggable = true;
      card.addEventListener("dragstart", (event) => {
        setPipelineDragStep(event, stepKey);
        card.classList.add("is-dragging");
      });
      card.addEventListener("dragend", () => {
        clearPipelineDragState();
      });
    }

    card.addEventListener("dragover", (event) => {
      const draggedStepKey = getDraggedPipelineStep(event);
      if (!draggedStepKey || draggedStepKey === stepKey) {
        return;
      }
      event.preventDefault();
      card.classList.add("is-drop-target");
    });
    card.addEventListener("dragleave", () => {
      card.classList.remove("is-drop-target");
    });
    card.addEventListener("drop", (event) => {
      const draggedStepKey = getDraggedPipelineStep(event);
      if (!draggedStepKey || draggedStepKey === stepKey) {
        return;
      }
      event.preventDefault();
      card.classList.remove("is-drop-target");
      movePipelineStep(loadout, draggedStepKey, stepKey);
      selectedPipelineStepKey = draggedStepKey;
      clearPipelineDragState();
      suppressPipelineStepClick = true;
      renderPipelineOrderList();
      renderPipelineStepEditor();
    });

    card.addEventListener("click", () => {
      if (suppressPipelineStepClick) {
        suppressPipelineStepClick = false;
        return;
      }
      selectedPipelineStepKey = stepKey;
      renderPipelineOrderList();
      renderPipelineStepEditor();
    });

    const handle = document.createElement("span");
    handle.className = "pipeline-step-handle";
    handle.textContent = ":::";
    if (isAuthor) {
      handle.classList.add("is-hidden");
    }

    const meta = document.createElement("div");
    meta.className = "pipeline-step-meta";

    const name = document.createElement("strong");
    name.className = "pipeline-step-name";
    name.textContent = getPipelineStepLabel(stepKey);

    const summary = document.createElement("p");
    summary.className = "pipeline-step-summary";
    summary.textContent = summarizePipelineStep(stepKey, stepConfig);

    meta.append(name, summary);

    const badge = document.createElement("span");
    badge.className = "pipeline-step-badge";
    badge.textContent = isAuthor ? "Pinned Last" : "Drag";

    card.append(handle, meta, badge);
    pipelineOrderList.appendChild(card);
  });
}

function renderPipelineStepEditor() {
  const loadout = getEditingLoadout();
  const stepKey = ensureSelectedPipelineStep(loadout);
  const stepConfig = loadout?.pipeline?.steps?.[stepKey];

  if (pipelineStepTitle) {
    pipelineStepTitle.textContent = `${getPipelineStepLabel(stepKey)} Settings`;
  }
  if (pipelineStepCopy) {
    pipelineStepCopy.textContent =
      stepKey === "author"
        ? "Author is pinned as the final visible-response step, but its inputs are still editable."
        : `Choose what the ${getPipelineStepLabel(stepKey)} can see before it runs.`;
  }
  if (pipelineMessageWindowInput) {
    pipelineMessageWindowInput.value = String(stepConfig?.messageWindow || 1);
  }
  if (pipelineIncludeCharacterCardsInput) {
    pipelineIncludeCharacterCardsInput.checked = Boolean(
      stepConfig?.includeCharacterCards
    );
  }
  if (!pipelineOutputList) {
    return;
  }

  pipelineOutputList.innerHTML = "";
  PIPELINE_OUTPUT_OPTIONS.forEach((option) => {
    const label = document.createElement("label");
    label.className = "pipeline-output-option";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(stepConfig?.previousOutputs?.includes(option.key));
    input.addEventListener("change", () => {
      const currentLoadout = getEditingLoadout();
      const currentStep = ensureSelectedPipelineStep(currentLoadout);
      const currentConfig = currentLoadout?.pipeline?.steps?.[currentStep];
      if (!currentConfig) {
        return;
      }

      currentConfig.previousOutputs = PIPELINE_OUTPUT_OPTIONS
        .filter((entry) =>
          entry.key === option.key ? input.checked : currentConfig.previousOutputs.includes(entry.key)
        )
        .map((entry) => entry.key);

      renderPipelineOrderList();
      renderPipelineStepEditor();
    });

    const text = document.createElement("span");
    text.textContent = option.label;
    label.append(input, text);
    pipelineOutputList.appendChild(label);
  });
}

function renderLoadoutDetailPanel() {
  const loadout = getEditingLoadout() || getSelectedLoadout();
  if (!loadout) {
    return;
  }

  ensureSelectedPipelineStep(loadout);

  const isPipeline = activeRoleKey === PIPELINE_EDITOR_KEY;
  if (roleTitle) {
    roleTitle.textContent = isPipeline
      ? "Pipeline"
      : roleData[activeRoleKey]?.title || "Model";
  }
  if (loadoutRoleFields) {
    loadoutRoleFields.hidden = isPipeline;
  }
  if (loadoutPipelineEditor) {
    loadoutPipelineEditor.hidden = !isPipeline;
  }

  if (isPipeline) {
    renderPipelineOrderList();
    renderPipelineStepEditor();
    return;
  }

  const role = loadout.roles[activeRoleKey] || loadout.roles.mind;
  if (roleLlm) roleLlm.value = role.llm || "";
  if (roleTemperature) roleTemperature.value = role.temperature || "";
  if (roleTopP) roleTopP.value = role.topP || "";
  if (roleMaxTokens) roleMaxTokens.value = role.maxTokens || "";
  if (roleInstructions) roleInstructions.value = role.instructions || "";
}

function setLoadoutMenuOpen(isOpen) {
  if (!selectedLoadoutButton || !loadoutSwitchMenu) {
    return;
  }

  isLoadoutMenuOpen = isOpen;
  selectedLoadoutButton.setAttribute("aria-expanded", String(isOpen));
  loadoutSwitchMenu.hidden = !isOpen;
}

function renderLoadoutSwitchMenu() {
  if (!loadoutSwitchMenu) {
    return;
  }

  loadoutSwitchMenu.innerHTML = "";

  loadouts.forEach((loadout) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "loadout-switch-option";
    if (loadout.id === selectedLoadoutId) {
      option.classList.add("is-active");
    }
    option.textContent = loadout.name;
    option.addEventListener("click", async () => {
      persistEditingRoleToLoadout();
      selectedLoadoutId = loadout.id;
      editingLoadoutId = loadout.id;
      syncLoadoutUI();
      renderLoadoutSelect();
      fillLoadoutForm(loadout);
      setLoadoutMenuOpen(false);

      try {
        await attachSelectedLoadoutToActiveChat();
      } catch (error) {
        setLoadoutStatus(error.message || "Failed to apply loadout to chat.");
      }
    });
    loadoutSwitchMenu.appendChild(option);
  });
}

function setChatCharacterMenuOpen(isOpen) {
  if (!addChatCharacterButton || !chatCharacterAddMenu) {
    return;
  }

  isChatCharacterMenuOpen = isOpen;
  addChatCharacterButton.setAttribute("aria-expanded", String(isOpen));
  chatCharacterAddMenu.hidden = !isOpen;
}

function renderChatCharacterAddMenu() {
  if (!chatCharacterAddMenu) {
    return;
  }

  chatCharacterAddMenu.innerHTML = "";

  if (!activeChat) {
    const empty = document.createElement("div");
    empty.className = "character-switch-empty";
    empty.textContent = "Open a chat first, then you can attach extra characters here.";
    chatCharacterAddMenu.appendChild(empty);
    return;
  }

  const activeIds = new Set(getChatCharacterIds(activeChat));
  const availableCharacters = characters.filter((character) => !activeIds.has(character.id));

  if (availableCharacters.length === 0) {
    const empty = document.createElement("div");
    empty.className = "character-switch-empty";
    empty.textContent = "All saved characters are already attached to this chat.";
    chatCharacterAddMenu.appendChild(empty);
    return;
  }

  availableCharacters.forEach((character) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "character-switch-option";

    const image = document.createElement("img");
    image.className = "character-switch-option-image";
    applyCharacterImage(image, getCharacterImage(character), `${character.name} portrait`);

    const text = document.createElement("span");
    text.className = "character-switch-option-text";

    const name = document.createElement("span");
    name.className = "character-switch-option-name";
    name.textContent = character.name;

    const meta = document.createElement("span");
    meta.className = "character-switch-option-meta";
    meta.textContent = getCharacterDisplayName(character);

    text.append(name, meta);
    option.append(image, text);
    option.addEventListener("click", () => {
      addCharacterToActiveChat(character.id).catch((error) => {
        setStatus(error.message || "Failed to add character to chat.");
      });
    });

    chatCharacterAddMenu.appendChild(option);
  });
}

function renderChatCharacterList() {
  if (!chatCharacterList) {
    return;
  }

  chatCharacterList.innerHTML = "";

  if (!activeChat) {
    const empty = document.createElement("div");
    empty.className = "chat-character-empty";
    empty.textContent = "Create or open a chat to manage its character roster.";
    chatCharacterList.appendChild(empty);
    return;
  }

  const activeIds = getChatCharacterIds(activeChat);
  if (activeIds.length === 0) {
    const empty = document.createElement("div");
    empty.className = "chat-character-empty";
    empty.textContent = "This chat has no attached characters yet.";
    chatCharacterList.appendChild(empty);
    return;
  }

  activeIds.forEach((characterId, index) => {
    const character = getCharacterById(characterId);
    if (!character) {
      return;
    }

    const card = document.createElement("div");
    card.className = "chat-character-card";
    if (selectedCharacterId === character.id) {
      card.classList.add("is-selected");
    }
    if (character.id === activeChat.characterId) {
      card.classList.add("is-lead");
    }

    const portrait = document.createElement("img");
    portrait.className = "chat-character-portrait";
    applyCharacterImage(portrait, getCharacterImage(character), `${character.name} portrait`);
    portrait.addEventListener("click", () => {
      selectedCharacterId = character.id;
      editingCharacterId = character.id;
      syncCharacterUI();
    });

    const body = document.createElement("div");
    body.className = "chat-character-body";

    const meta = document.createElement("div");
    meta.className = "chat-character-meta";

    const nameButton = document.createElement("button");
    nameButton.type = "button";
    nameButton.className = "chat-character-name-button";
    nameButton.textContent = character.name;
    nameButton.addEventListener("click", () => {
      selectedCharacterId = character.id;
      editingCharacterId = character.id;
      syncCharacterUI();
    });

    meta.appendChild(nameButton);

    if (index === 0) {
      const badge = document.createElement("span");
      badge.className = "chat-character-badge";
      badge.textContent = "Lead Reply";
      meta.appendChild(badge);
    }

    const submeta = document.createElement("p");
    submeta.className = "chat-character-submeta";
    submeta.textContent =
      index === 0
        ? "This character is currently the visible responder for the chat."
        : "This character's card data is included in the hidden chat roster prompt.";

    const actions = document.createElement("div");
    actions.className = "chat-character-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "chat-character-action";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => {
      selectedCharacterId = character.id;
      editingCharacterId = character.id;
      openEditor("character-editor");
    });
    actions.appendChild(editButton);

    if (index > 0) {
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "chat-character-action chat-character-action-danger";
      removeButton.textContent = "Remove";
      removeButton.addEventListener("click", () => {
        removeCharacterFromActiveChat(character.id).catch((error) => {
          setStatus(error.message || "Failed to remove character from chat.");
        });
      });
      actions.appendChild(removeButton);
    }

    body.append(meta, submeta, actions);
    card.append(portrait, body);
    chatCharacterList.appendChild(card);
  });
}

async function saveActiveChatCharacterRoster() {
  if (!activeChat) {
    return;
  }

  const characterIds = getChatCharacterIds(activeChat);
  const characterNames = characterIds
    .map((characterId) => getCharacterById(characterId)?.name)
    .filter(Boolean);

  activeChat.characterIds = characterIds;
  activeChat.characterId = characterIds[0] || null;
  activeChat.characterNames = characterNames;
  activeChat.characterName = characterNames[0] || "Character";

  await saveActiveChatEdits();
  syncCharacterUI();
  renderActiveChat();
}

async function addCharacterToActiveChat(characterId) {
  if (!activeChat) {
    throw new Error("Open a chat before adding characters.");
  }

  const character = getCharacterById(characterId);
  if (!character) {
    throw new Error("Character not found.");
  }

  const currentIds = getChatCharacterIds(activeChat);
  if (currentIds.includes(characterId)) {
    setChatCharacterMenuOpen(false);
    return;
  }

  activeChat.characterIds = [...currentIds, characterId];
  selectedCharacterId = characterId;
  editingCharacterId = characterId;
  setChatCharacterMenuOpen(false);
  await saveActiveChatCharacterRoster();
}

async function removeCharacterFromActiveChat(characterId) {
  if (!activeChat) {
    return;
  }

  const currentIds = getChatCharacterIds(activeChat);
  if (currentIds[0] === characterId) {
    throw new Error("The lead character cannot be removed from the chat yet.");
  }

  activeChat.characterIds = currentIds.filter((id) => id !== characterId);
  if (selectedCharacterId === characterId) {
    selectedCharacterId = activeChat.characterIds[0] || null;
    editingCharacterId = selectedCharacterId;
  }
  await saveActiveChatCharacterRoster();
}

function fillLoadoutForm(loadout) {
  const effective = loadout
    ? normalizeLoadout(loadout)
    : normalizeLoadout(createLoadoutTemplate(loadouts.length + 1));
  const existingIndex = loadouts.findIndex((entry) => entry.id === effective.id);
  if (existingIndex >= 0) {
    loadouts.splice(existingIndex, 1, effective);
  }
  editingLoadoutId = effective.id;

  if (loadoutTitleInput) {
    loadoutTitleInput.value = effective.name;
  }

  ensureSelectedPipelineStep(effective);
  renderLoadoutDetailPanel();
  renderLoadoutSelect();
}

function persistEditingRoleToLoadout() {
  const loadout = getEditingLoadout();
  if (!loadout || activeRoleKey === PIPELINE_EDITOR_KEY) {
    return;
  }

  loadout.name = (loadoutTitleInput?.value || loadout.name || "Model Loadout").trim();
  loadout.roles[activeRoleKey] = {
    llm: roleLlm?.value || "",
    temperature: roleTemperature?.value || "",
    topP: roleTopP?.value || "",
    maxTokens: roleMaxTokens?.value || "",
    instructions: roleInstructions?.value || "",
  };
}

function renderCharacterTileGrid() {
  if (!characterTileGrid) {
    return;
  }

  characterTileGrid.innerHTML = "";

  const addTile = document.createElement("button");
  addTile.type = "button";
  addTile.className = "character-tile character-tile-add";
  addTile.setAttribute("aria-label", "Create new character");
  addTile.innerHTML = `
    <div class="character-tile-image-wrap character-tile-add-visual">
      <span class="character-tile-plus">+</span>
    </div>
    <strong class="character-tile-name">New Character</strong>
  `;
  addTile.addEventListener("click", () => {
    createCharacterDraft();
  });
  characterTileGrid.appendChild(addTile);

  characters.forEach((character) => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "character-tile";
    if (character.id === selectedCharacterId) {
      tile.classList.add("is-active");
    }

    const imageWrap = document.createElement("div");
    imageWrap.className = "character-tile-image-wrap";
    const image = document.createElement("img");
    image.className = "character-tile-image";
    applyCharacterImage(image, getCharacterImage(character), `${character.name} portrait`);

    const name = document.createElement("strong");
    name.className = "character-tile-name";
    name.textContent = character.name;

    imageWrap.appendChild(image);
    tile.append(imageWrap, name);
    tile.addEventListener("click", () => {
      selectedCharacterId = character.id;
      editingCharacterId = character.id;
      syncCharacterUI();
      renderCharacterTileGrid();
      fillCharacterForm(character);
      openEditor("character-editor");
    });

    characterTileGrid.appendChild(tile);
  });
}

function renderChatList() {
  if (!chatList) {
    return;
  }

  chatList.innerHTML = "";

  const newChatButton = document.createElement("button");
  newChatButton.type = "button";
  newChatButton.className = "list-card chat-card new-chat-card";
  newChatButton.innerHTML = `
    <span class="new-chat-plus">+</span>
    <strong>New Chat</strong>
    <span class="chat-persona">Start a new conversation</span>
  `;
  newChatButton.addEventListener("click", () => {
    createNewChat();
  });
  chatList.appendChild(newChatButton);

  chats.forEach((chat) => {
    const normalizedChat = normalizeChatRecord(chat);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "list-card chat-card";
    if (activeChat && normalizedChat.fileName === activeChat.fileName) {
      button.classList.add("is-active");
    }

    const meta = document.createElement("span");
    meta.className = "meta-line";
    meta.textContent = formatChatMeta(normalizedChat);

    const title = document.createElement("strong");
    title.textContent = normalizedChat.title;

    const persona = document.createElement("span");
    persona.className = "chat-persona";
    persona.textContent = normalizedChat.characterName || "Character";

    button.append(meta, title, persona);
    button.addEventListener("click", () => {
      if (pageType === "home") {
        window.location.href = `chat.html?chat=${encodeURIComponent(normalizedChat.fileName)}`;
        return;
      }
      loadActiveChat(normalizedChat.fileName);
    });

    chatList.appendChild(button);
  });
}

function createMessageElement(message, character) {
  const article = document.createElement("article");
  article.className = `message ${message.role === "assistant" ? "assistant-message" : "user-message"}`;

  if (message.role === "assistant") {
    const shell = document.createElement("div");
    shell.className = "message-shell";

    const avatar = document.createElement("img");
    avatar.className = "message-avatar character-driven-avatar";
    applyCharacterImage(
      avatar,
      getCharacterImage(character),
      `${getCharacterDisplayName(character)} avatar`
    );

    const body = document.createElement("div");
    body.className = "message-body";
    body.dataset.messageId = message.id;

    const editButton = document.createElement("button");
    editButton.className = "message-edit-button";
    editButton.type = "button";
    editButton.setAttribute("aria-label", "Edit message");
    editButton.addEventListener("click", () => {
      startMessageEditing(article, message.id);
    });

    const label = document.createElement("span");
    label.className = "message-label";
    label.textContent = getCharacterDisplayName(character);

    const paragraph = document.createElement("p");
    paragraph.textContent = message.content;

    body.append(editButton, label, paragraph);
    shell.append(avatar, body);
    article.appendChild(shell);
    return article;
  }

  const body = document.createElement("div");
  body.className = "message-body";
  body.dataset.messageId = message.id;

  const editButton = document.createElement("button");
  editButton.className = "message-edit-button";
  editButton.type = "button";
  editButton.setAttribute("aria-label", "Edit message");
  editButton.addEventListener("click", () => {
    startMessageEditing(article, message.id);
  });

  const label = document.createElement("span");
  label.className = "message-label";
  label.textContent = "User";

  const paragraph = document.createElement("p");
  paragraph.textContent = message.content;

  body.append(editButton, label, paragraph);
  article.appendChild(body);
  return article;
}

function renderActiveChat() {
  if (!chatWindow || pageType !== "chat") {
    return;
  }

  chatWindow.innerHTML = "";

  if (!activeChat) {
    chatTitle.textContent = "New Chat";
    chatCharacterSubtitle.textContent = "No Character";
    const empty = document.createElement("div");
    empty.className = "chat-empty-state";
    empty.textContent = "Create or select a chat to begin.";
    chatWindow.appendChild(empty);
    return;
  }

  chatTitle.textContent = activeChat.title || "New Chat";
  const character = getCharacterById(activeChat.characterId);
  chatCharacterSubtitle.textContent = formatChatCharacterSubtitle(activeChat);

  if (!activeChat.messages.length) {
    const empty = document.createElement("div");
    empty.className = "chat-empty-state";
    empty.textContent = "Send the first message to start this conversation.";
    chatWindow.appendChild(empty);
    return;
  }

  activeChat.messages.forEach((message) => {
    chatWindow.appendChild(createMessageElement(message, character));
  });
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function setComposerDisabled(disabled) {
  if (!composerInput || !sendMessageButton) {
    return;
  }

  composerInput.disabled = disabled;
  sendMessageButton.disabled = disabled;
}

function autosizeComposer() {
  if (!composerInput) {
    return;
  }
  composerInput.style.height = "0px";
  composerInput.style.height = `${Math.max(56, composerInput.scrollHeight)}px`;
}

function updateChatSummary(fullChat) {
  const normalizedChat = normalizeChatRecord(fullChat);
  const existing = chats.findIndex((chat) => chat.fileName === fullChat.fileName);
  const character = getCharacterById(normalizedChat.characterId);
  const summary = {
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

  if (existing >= 0) {
    chats.splice(existing, 1);
  }
  chats.unshift(summary);
}

async function attachSelectedLoadoutToActiveChat() {
  if (!activeChat) {
    return;
  }

  const loadout = getSelectedLoadout();
  activeChat.loadoutId = selectedLoadoutId || null;
  activeChat.loadoutName = loadout?.name || "No Loadout";

  const payload = await apiRequest("/chats/save", {
    method: "POST",
    body: JSON.stringify({ chat: activeChat }),
  });

  activeChat = normalizeChatRecord(payload.chat);
  updateChatSummary(activeChat);
  renderChatList();
}

async function loadCharactersFromPc() {
  const payload = await apiRequest("/characters");
  characters = (payload.characters || []).map((character) => normalizeCharacter(character));
  characterDirectory = payload.directory || "";
  chats = chats.map((chat) => normalizeChatRecord(chat));
  if (activeChat) {
    activeChat = normalizeChatRecord(activeChat);
  }

  if (!selectedCharacterId && characters.length > 0) {
    selectedCharacterId = characters[0].id;
    editingCharacterId = selectedCharacterId;
  }

  syncCharacterUI();
  renderCharacterTileGrid();
}

async function loadLoadoutsFromPc() {
  const payload = await apiRequest("/loadouts");
  loadouts = (payload.loadouts || []).map((loadout) => normalizeLoadout(loadout));
  loadoutDirectory = payload.directory || "";

  if (!selectedLoadoutId && loadouts.length > 0) {
    selectedLoadoutId = loadouts[0].id;
    editingLoadoutId = selectedLoadoutId;
  } else if (!loadouts.some((loadout) => loadout.id === selectedLoadoutId)) {
    selectedLoadoutId = loadouts[0]?.id || null;
    editingLoadoutId = selectedLoadoutId;
  }

  syncLoadoutUI();
  renderLoadoutSelect();
  fillLoadoutForm(getSelectedLoadout());
}

async function loadChatsFromPc() {
  const payload = await apiRequest("/chats");
  chats = (payload.chats || []).map((chat) => normalizeChatRecord(chat));
  chatDirectory = payload.directory || "";
  renderChatList();
}

async function loadActiveChat(fileName) {
  const payload = await apiRequest(`/chats/${encodeURIComponent(fileName)}`);
  activeChat = normalizeChatRecord(payload.chat);
  const activeIds = getChatCharacterIds(activeChat);
  selectedCharacterId =
    selectedCharacterId && activeIds.includes(selectedCharacterId)
      ? selectedCharacterId
      : activeChat.characterId;
  editingCharacterId = selectedCharacterId;
  selectedLoadoutId = activeChat.loadoutId || selectedLoadoutId;
  editingLoadoutId = selectedLoadoutId;
  syncCharacterUI();
  syncLoadoutUI();
  renderChatList();
  renderActiveChat();
  const url = new URL(window.location.href);
  url.searchParams.set("chat", activeChat.fileName);
  window.history.replaceState({}, "", url);
}

async function createNewChat() {
  const characterId = selectedCharacterId || characters[0]?.id;
  const loadoutId = selectedLoadoutId || loadouts[0]?.id;
  if (!characterId) {
    setStatus("Create a character first.");
    return;
  }

  const payload = await apiRequest("/chats/create", {
    method: "POST",
    body: JSON.stringify({ characterId, loadoutId }),
  });

  updateChatSummary(payload.chat);
  renderChatList();

  if (pageType === "home") {
    window.location.href = `chat.html?chat=${encodeURIComponent(payload.chat.fileName)}`;
    return;
  }

  await loadActiveChat(payload.chat.fileName);
}

async function saveCurrentLoadoutToPc() {
  persistEditingRoleToLoadout();
  let loadout = getEditingLoadout();
  if (!loadout) {
    loadout = normalizeLoadout(createLoadoutTemplate(loadouts.length + 1));
    loadouts.push(loadout);
    editingLoadoutId = loadout.id;
  }
  syncPipelineConfigInPlace(loadout);

  const payload = await apiRequest("/loadouts/save", {
    method: "POST",
    body: JSON.stringify({
      loadout,
      previousFileName: loadout.fileName || null,
    }),
  });

  const savedLoadout = normalizeLoadout(payload.loadout);
  const existingIndex = loadouts.findIndex((entry) => entry.id === savedLoadout.id);
  if (existingIndex >= 0) {
    loadouts.splice(existingIndex, 1, savedLoadout);
  } else {
    loadouts.push(savedLoadout);
  }

  selectedLoadoutId = savedLoadout.id;
  editingLoadoutId = savedLoadout.id;
  loadoutDirectory = payload.directory || loadoutDirectory;
  syncLoadoutUI();
  renderLoadoutSelect();
  fillLoadoutForm(savedLoadout);

  if (activeChat && activeChat.loadoutId === savedLoadout.id) {
    await attachSelectedLoadoutToActiveChat();
  }

  setLoadoutStatus(
    loadoutDirectory
      ? `Saved to ${loadoutDirectory}\\${savedLoadout.fileName}`
      : `Saved ${savedLoadout.fileName}`
  );
}

async function deleteCurrentLoadout() {
  const loadout = getEditingLoadout();
  if (!loadout) {
    return;
  }

  const confirmed = window.confirm(`Delete ${loadout.name}?`);
  if (!confirmed) {
    return;
  }

  if (loadout.fileName) {
    await apiRequest(`/loadouts/${encodeURIComponent(loadout.fileName)}`, {
      method: "DELETE",
    });
  }

  loadouts = loadouts.filter((entry) => entry.id !== loadout.id);
  selectedLoadoutId = loadouts[0]?.id || null;
  editingLoadoutId = selectedLoadoutId;
  syncLoadoutUI();
  renderLoadoutSelect();
  fillLoadoutForm(getSelectedLoadout());

  if (activeChat && activeChat.loadoutId === loadout.id) {
    await attachSelectedLoadoutToActiveChat();
  }

  setLoadoutStatus(
    loadoutDirectory
      ? `Deleted ${loadout.fileName || loadout.name} from ${loadoutDirectory}`
      : `Deleted ${loadout.name}`
  );
}

function createLoadoutDraft() {
  persistEditingRoleToLoadout();
  const loadout = normalizeLoadout(createLoadoutTemplate(loadouts.length + 1));
  loadouts.push(loadout);
  selectedLoadoutId = loadout.id;
  editingLoadoutId = loadout.id;
  syncLoadoutUI();
  fillLoadoutForm(loadout);
  renderLoadoutSelect();
  setLoadoutStatus("New unsaved loadout draft created.");
}

async function saveCurrentCharacterToPc() {
  const character = getEditingCharacter();
  if (!character) {
    throw new Error("No character selected.");
  }

  const draft = {
    ...character,
    ...readCharacterForm(),
  };

  const payload = await apiRequest("/characters/save", {
    method: "POST",
    body: JSON.stringify({
      character: draft,
      previousFileName: character.fileName || null,
    }),
  });

  const savedCharacter = normalizeCharacter(payload.character);
  const index = characters.findIndex((entry) => entry.id === savedCharacter.id);
  if (index >= 0) {
    characters.splice(index, 1, savedCharacter);
  } else {
    characters.push(savedCharacter);
  }

  selectedCharacterId = savedCharacter.id;
  editingCharacterId = savedCharacter.id;
  characterDirectory = payload.directory || characterDirectory;
  chats = chats.map((chat) => normalizeChatRecord(chat));
  if (activeChat) {
    activeChat = normalizeChatRecord(activeChat);
  }
  syncCharacterUI();
  renderCharacterTileGrid();
  renderChatList();
  renderActiveChat();
  fillCharacterForm(savedCharacter);
  setStatus(
    characterDirectory
      ? `Saved to ${characterDirectory}\\${savedCharacter.fileName}`
      : `Saved ${savedCharacter.fileName}`
  );
}

async function deleteCurrentCharacter() {
  const character = getEditingCharacter();
  if (!character) {
    return;
  }

  if (activeChat && getChatCharacterIds(activeChat).includes(character.id)) {
    throw new Error("This character is attached to the open chat. Remove it from the chat first.");
  }

  const confirmed = window.confirm(`Delete ${character.name}?`);
  if (!confirmed) {
    return;
  }

  if (character.fileName) {
    await apiRequest(`/characters/${encodeURIComponent(character.fileName)}`, {
      method: "DELETE",
    });
  }

  characters = characters.filter((entry) => entry.id !== character.id);
  selectedCharacterId = characters[0]?.id || null;
  editingCharacterId = selectedCharacterId;
  syncCharacterUI();
  renderCharacterTileGrid();
  renderChatList();
  fillCharacterForm(getSelectedCharacter());
  setStatus(
    characterDirectory
      ? `Deleted ${character.fileName || character.name} from ${characterDirectory}`
      : `Deleted ${character.name}`
  );

  if (pageType === "home") {
    closeEditors();
  }
}

function createCharacterDraft() {
  const character = createCharacterTemplate(characters.length + 1);
  characters.push(character);
  selectedCharacterId = character.id;
  editingCharacterId = character.id;
  syncCharacterUI();
  renderCharacterTileGrid();
  fillCharacterForm(character);
  openEditor("character-editor");
}

function autosizeMessageEditor(textarea) {
  textarea.style.height = "0px";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

async function saveActiveChatEdits() {
  if (!activeChat) {
    return;
  }

  const payload = await apiRequest("/chats/save", {
    method: "POST",
    body: JSON.stringify({ chat: activeChat }),
  });
  activeChat = normalizeChatRecord(payload.chat);
  updateChatSummary(activeChat);
  renderChatList();
}

async function stopMessageEditing(messageElement, messageId, saveChanges) {
  const body = messageElement.querySelector(".message-body");
  const paragraph = body?.querySelector("p");
  const editor = body?.querySelector(".message-inline-editor");
  if (!body || !paragraph || !editor) {
    return;
  }

  if (saveChanges && activeChat) {
    const message = activeChat.messages.find((entry) => entry.id === messageId);
    if (message) {
      message.content = editor.value;
      paragraph.textContent = editor.value;
      await saveActiveChatEdits();
    }
  }

  editor.remove();
  paragraph.hidden = false;
  messageElement.classList.remove("is-editing");
  messageElement.style.minHeight = "";
}

function startMessageEditing(messageElement, messageId) {
  const body = messageElement.querySelector(".message-body");
  const paragraph = body?.querySelector("p");
  if (!body || !paragraph || body.querySelector(".message-inline-editor")) {
    return;
  }

  const editor = document.createElement("textarea");
  editor.className = "message-inline-editor";
  editor.value = paragraph.textContent.trim();
  editor.setAttribute("aria-label", "Edit message text");

  messageElement.style.minHeight = `${messageElement.offsetHeight}px`;
  paragraph.hidden = true;
  body.appendChild(editor);
  messageElement.classList.add("is-editing");

  autosizeMessageEditor(editor);
  editor.style.minHeight = `${paragraph.offsetHeight}px`;
  editor.focus();
  editor.setSelectionRange(editor.value.length, editor.value.length);

  editor.addEventListener("input", () => autosizeMessageEditor(editor));
  editor.addEventListener("blur", () => {
    stopMessageEditing(messageElement, messageId, true);
  });
  editor.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      stopMessageEditing(messageElement, messageId, false);
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      stopMessageEditing(messageElement, messageId, true);
    }
  });
}

async function sendCurrentMessage() {
  if (!composerInput || isSending) {
    return;
  }

  const content = composerInput.value.trim();
  if (!content) {
    return;
  }

  if (!activeChat) {
    await createNewChat();
  }

  if (!activeChat) {
    return;
  }

  isSending = true;
  setComposerDisabled(true);

  try {
    const payload = await apiRequest("/chats/message", {
      method: "POST",
      body: JSON.stringify({
        chatFileName: activeChat.fileName,
        content,
      }),
    });

    activeChat = normalizeChatRecord(payload.chat);
    const activeIds = getChatCharacterIds(activeChat);
    selectedCharacterId =
      selectedCharacterId && activeIds.includes(selectedCharacterId)
        ? selectedCharacterId
        : activeChat.characterId;
    editingCharacterId = selectedCharacterId;
    composerInput.value = "";
    autosizeComposer();
    updateChatSummary(activeChat);
    syncCharacterUI();
    renderChatList();
    renderActiveChat();
  } catch (error) {
    setStatus(error.message || "Sending message failed.");
  } finally {
    isSending = false;
    setComposerDisabled(false);
    composerInput?.focus();
  }
}

function closeEditors() {
  overlays.forEach((overlay) => {
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
  });

  if (defaultSurface) {
    defaultSurface.removeAttribute("aria-hidden");
  }
}

function setRole(roleKey) {
  persistEditingRoleToLoadout();
  if (roleKey !== PIPELINE_EDITOR_KEY && !roleData[roleKey]) {
    return;
  }

  activeRoleKey = roleKey;

  roleButtons.forEach((button) => {
    button.classList.toggle(
      "is-active",
      button.getAttribute("data-role-select") === roleKey
    );
  });

  renderLoadoutDetailPanel();
}

function openEditor(targetId) {
  closeEditors();

  const target = document.getElementById(targetId);
  if (!target) {
    return;
  }

  if (targetId === "character-editor") {
    fillCharacterForm(getEditingCharacter() || getSelectedCharacter());
  }
  if (targetId === "model-editor") {
    fillLoadoutForm(getEditingLoadout() || getSelectedLoadout());
  }

  target.classList.add("is-open");
  target.setAttribute("aria-hidden", "false");

  if (defaultSurface) {
    defaultSurface.setAttribute("aria-hidden", "true");
  }
}

async function initializeHome() {
  await Promise.all([loadCharactersFromPc(), loadLoadoutsFromPc(), loadChatsFromPc()]);
  if (!selectedCharacterId && characters.length) {
    selectedCharacterId = characters[0].id;
    editingCharacterId = selectedCharacterId;
  }
  syncCharacterUI();
  renderCharacterTileGrid();
  renderChatList();
  fillCharacterForm(getSelectedCharacter());
  if (characterDirectory) {
    setStatus(`Characters loaded from ${characterDirectory}`);
  }
}

async function initializeChat() {
  await Promise.all([loadCharactersFromPc(), loadLoadoutsFromPc(), loadChatsFromPc()]);
  const params = new URLSearchParams(window.location.search);
  const requestedChat = params.get("chat");

  if (requestedChat) {
    await loadActiveChat(requestedChat);
  } else if (chats.length) {
    await loadActiveChat(chats[0].fileName);
  } else {
    renderActiveChat();
  }

  syncCharacterUI();
  syncLoadoutUI();
  if (loadoutDirectory) {
    setLoadoutStatus(`Model loadouts loaded from ${loadoutDirectory}`);
  }
}

document.querySelectorAll("[data-open-editor]").forEach((button) => {
  button.addEventListener("click", () => {
    openEditor(button.getAttribute("data-open-editor"));
  });
});

document.querySelectorAll("[data-close-editor]").forEach((button) => {
  button.addEventListener("click", () => {
    closeEditors();
  });
});

addChatCharacterButton?.addEventListener("click", () => {
  renderChatCharacterAddMenu();
  setChatCharacterMenuOpen(!isChatCharacterMenuOpen);
});

editSidebarCharacterButton?.addEventListener("click", () => {
  const character = getSidebarCharacter();
  if (!character) {
    setStatus("Select a character first.");
    return;
  }

  selectedCharacterId = character.id;
  editingCharacterId = character.id;
  openEditor("character-editor");
});

selectedLoadoutButton?.addEventListener("click", () => {
  renderLoadoutSwitchMenu();
  setLoadoutMenuOpen(!isLoadoutMenuOpen);
});

roleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setRole(button.getAttribute("data-role-select"));
  });
});

saveCharacterButton?.addEventListener("click", () => {
  saveCurrentCharacterToPc().catch((error) => {
    setStatus(error.message || "Save failed.");
  });
});

deleteCharacterButton?.addEventListener("click", () => {
  deleteCurrentCharacter().catch((error) => {
    setStatus(error.message || "Delete failed.");
  });
});

saveLoadoutButton?.addEventListener("click", () => {
  saveCurrentLoadoutToPc().catch((error) => {
    setLoadoutStatus(error.message || "Save failed.");
  });
});

deleteLoadoutButton?.addEventListener("click", () => {
  deleteCurrentLoadout().catch((error) => {
    setLoadoutStatus(error.message || "Delete failed.");
  });
});

newLoadoutButton?.addEventListener("click", () => {
  createLoadoutDraft();
});

loadoutSelect?.addEventListener("change", () => {
  persistEditingRoleToLoadout();
  editingLoadoutId = loadoutSelect.value;
  selectedLoadoutId = editingLoadoutId;
  syncLoadoutUI();
  fillLoadoutForm(getEditingLoadout());
  attachSelectedLoadoutToActiveChat().catch((error) => {
    setLoadoutStatus(error.message || "Failed to apply loadout to chat.");
  });
});

characterNameInput?.addEventListener("input", () => {
  updateCharacterTitles(characterNameInput.value);
});

loadoutTitleInput?.addEventListener("input", () => {
  const loadout = getEditingLoadout();
  if (!loadout) {
    return;
  }
  loadout.name = loadoutTitleInput.value.trim() || "Model Loadout";
  renderLoadoutSelect();
  if (selectedLoadoutId === loadout.id) {
    syncLoadoutUI();
  }
});

pipelineMessageWindowInput?.addEventListener("change", () => {
  const loadout = getEditingLoadout();
  const stepKey = ensureSelectedPipelineStep(loadout);
  const step = loadout?.pipeline?.steps?.[stepKey];
  if (!step) {
    return;
  }

  const nextValue = Number(pipelineMessageWindowInput.value);
  step.messageWindow =
    Number.isFinite(nextValue) && nextValue > 0
      ? Math.floor(nextValue)
      : createDefaultPipelineConfig().steps[stepKey].messageWindow;
  renderPipelineOrderList();
  renderPipelineStepEditor();
});

pipelineIncludeCharacterCardsInput?.addEventListener("change", () => {
  const loadout = getEditingLoadout();
  const stepKey = ensureSelectedPipelineStep(loadout);
  const step = loadout?.pipeline?.steps?.[stepKey];
  if (!step) {
    return;
  }

  step.includeCharacterCards = pipelineIncludeCharacterCardsInput.checked;
  renderPipelineOrderList();
  renderPipelineStepEditor();
});

characterImageFileInput?.addEventListener("change", (event) => {
  const file = event.currentTarget?.files?.[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const current = getEditingCharacter();
    if (!current) {
      return;
    }
    current.image = typeof reader.result === "string" ? reader.result : DEFAULT_CHARACTER_IMAGE;
    applyCharacterImage(
      characterPortraitPreview,
      current.image,
      `${characterNameInput?.value?.trim() || "Character"} portrait preview`
    );
  };
  reader.readAsDataURL(file);
});

composerInput?.addEventListener("input", () => {
  autosizeComposer();
});

composerInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendCurrentMessage();
  }
});

sendMessageButton?.addEventListener("click", () => {
  sendCurrentMessage();
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Node)) {
    return;
  }

  if (
    isLoadoutMenuOpen &&
    selectedLoadoutButton &&
    loadoutSwitchMenu &&
    !selectedLoadoutButton.contains(target) &&
    !loadoutSwitchMenu.contains(target)
  ) {
    setLoadoutMenuOpen(false);
  }

  if (
    isChatCharacterMenuOpen &&
    addChatCharacterButton &&
    chatCharacterAddMenu &&
    !addChatCharacterButton.contains(target) &&
    !chatCharacterAddMenu.contains(target)
  ) {
    setChatCharacterMenuOpen(false);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (isLoadoutMenuOpen) {
      setLoadoutMenuOpen(false);
    }
    if (isChatCharacterMenuOpen) {
      setChatCharacterMenuOpen(false);
    }
  }
});

setRole("mind");
autosizeComposer();

if (pageType === "chat") {
  initializeChat().catch((error) => {
    setLoadoutStatus(error.message || "Failed to initialize chat.");
  });
} else {
  initializeHome().catch((error) => {
    setStatus(error.message || "Failed to initialize home.");
  });
}
