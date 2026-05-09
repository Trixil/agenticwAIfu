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

const roleData = {
  mind: {
    title: "Mind Model",
    llm: "gpt-oss-cinematic",
    temperature: "1.05",
    topP: "0.92",
    maxTokens: "4096",
    instructions:
      "Coordinate the overall reasoning pass, track the current scene state, and decide which specialist models should influence the next response.",
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
    instructions:
      "# Stat LLM System Instructions\n\nYou are the Stat LLM for a long-term interactive fiction character.\n\nYour job is to update the hidden relationship stats between the character and the user.\n\nUse the current relationship stats, the updated Mental Synopsis, the updated Mid-Term Goals, the last 5 messages, the latest user input, the character description, and the current scene context.\n\n## Relationship Stats\n\n### Affection\n\nHow emotionally fond, warm, or attached the character feels toward the user.\n\n### Trust\n\nHow safe, honest, and reliable the character believes the user is.\n\n### Comfort\n\nHow relaxed, unguarded, and emotionally safe the character feels around the user.\n\nStats range from 0.0 to 100.0 and must stay within that range.\n\n## Evaluation Rules\n\nJudge the user's actions from the character's perspective, not from the user's intention alone.\n\nA kind action can still feel intrusive.\n\nAn awkward action can still feel sincere.\n\nConsider whether the user noticed her feelings, respected her boundaries, supported her desires, pressured her, ignored her, helped her goals, frightened her, humiliated her, or treated her as a person with agency.\n\nMost ordinary interactions should cause tiny changes or no change.\n\nLarge changes should only happen after emotionally significant events, repeated patterns, major care, betrayal, vulnerability, coercion, cruelty, rescue, abandonment, honesty, or serious boundary violations.\n\n## Suggested Delta Scale\n\n- No effect: 0.0\n- Tiny effect: +/-0.1 to +/-0.3\n- Small effect: +/-0.4 to +/-0.8\n- Moderate effect: +/-0.9 to +/-2.0\n- Major event: +/-2.1 to +/-5.0\n- Extreme story-defining event: +/-5.1 to +/-10.0\n\nDo not reward gifts, praise, or affection automatically.\n\nConsider whether the character wanted it, believed it, felt safe receiving it, or felt controlled by it.\n\nDo not write narration.\n\nDo not write dialogue.\n\nDo not mention prompts, system logic, or that you are an LLM.\n\n## Expected Output\n\nWrite only the updated relationship stats in this exact plain-text format:\n\nAFFECTION: 20.0/100.0\nTRUST: 20.0/100.0\nCOMFORT: 20.0/100.0\n\nNo bullets.\n\nNo JSON.\n\nNo code fences.\n\nNo extra explanation.",
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
    instructions:
      "Track character motivations, evaluate short-term objectives, and suggest next-scene priorities based on the current state.",
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
let isSending = false;
let isLoadoutMenuOpen = false;

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
  };
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

function getSelectedLoadout() {
  return getLoadoutById(selectedLoadoutId);
}

function getEditingLoadout() {
  return getLoadoutById(editingLoadoutId);
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
  };
}

function syncCharacterUI() {
  const character = getSelectedCharacter();
  const displayName = getCharacterDisplayName(character);
  const image = getCharacterImage(character);

  if (selectedCharacterName) {
    selectedCharacterName.textContent = character?.name || "No Character";
  }
  if (chatCharacterSubtitle) {
    chatCharacterSubtitle.textContent = character ? displayName : "No Character";
  }
  applyCharacterImage(
    selectedCharacterImage,
    image,
    character ? `${character.name} portrait` : "Character portrait"
  );
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

function fillLoadoutForm(loadout) {
  const effective = loadout ? normalizeLoadout(loadout) : normalizeLoadout(createLoadoutTemplate(loadouts.length + 1));
  editingLoadoutId = effective.id;

  if (loadoutTitleInput) {
    loadoutTitleInput.value = effective.name;
  }

  const role = effective.roles[activeRoleKey] || effective.roles.mind;
  if (roleTitle) roleTitle.textContent = roleData[activeRoleKey].title;
  if (roleLlm) roleLlm.value = role.llm || "";
  if (roleTemperature) roleTemperature.value = role.temperature || "";
  if (roleTopP) roleTopP.value = role.topP || "";
  if (roleMaxTokens) roleMaxTokens.value = role.maxTokens || "";
  if (roleInstructions) roleInstructions.value = role.instructions || "";
  renderLoadoutSelect();
}

function persistEditingRoleToLoadout() {
  const loadout = getEditingLoadout();
  if (!loadout) {
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
    const button = document.createElement("button");
    button.type = "button";
    button.className = "list-card chat-card";
    if (activeChat && chat.fileName === activeChat.fileName) {
      button.classList.add("is-active");
    }

    const meta = document.createElement("span");
    meta.className = "meta-line";
    meta.textContent = formatChatMeta(chat);

    const title = document.createElement("strong");
    title.textContent = chat.title;

    const persona = document.createElement("span");
    persona.className = "chat-persona";
    persona.textContent = chat.characterName || "Character";

    button.append(meta, title, persona);
    button.addEventListener("click", () => {
      if (pageType === "home") {
        window.location.href = `chat.html?chat=${encodeURIComponent(chat.fileName)}`;
        return;
      }
      loadActiveChat(chat.fileName);
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
  chatCharacterSubtitle.textContent = getCharacterDisplayName(character);

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
  const existing = chats.findIndex((chat) => chat.fileName === fullChat.fileName);
  const character = getCharacterById(fullChat.characterId);
  const summary = {
    id: fullChat.id,
    fileName: fullChat.fileName,
    title: fullChat.title,
    characterId: fullChat.characterId,
    characterName: character?.name || fullChat.characterName || "Character",
    updatedAt: fullChat.updatedAt,
    createdAt: fullChat.createdAt,
    messageCount: Array.isArray(fullChat.messages) ? fullChat.messages.length : 0,
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

  activeChat = payload.chat;
  updateChatSummary(activeChat);
  renderChatList();
}

async function loadCharactersFromPc() {
  const payload = await apiRequest("/characters");
  characters = (payload.characters || []).map((character) => normalizeCharacter(character));
  characterDirectory = payload.directory || "";

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
  chats = payload.chats || [];
  chatDirectory = payload.directory || "";
  renderChatList();
}

async function loadActiveChat(fileName) {
  const payload = await apiRequest(`/chats/${encodeURIComponent(fileName)}`);
  activeChat = payload.chat;
  selectedCharacterId = activeChat.characterId;
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
  syncCharacterUI();
  renderCharacterTileGrid();
  renderChatList();
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
  activeChat = payload.chat;
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

    activeChat = payload.chat;
    selectedCharacterId = activeChat.characterId;
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
  const role = roleData[roleKey];
  if (!role) {
    return;
  }

  activeRoleKey = roleKey;

  roleButtons.forEach((button) => {
    button.classList.toggle(
      "is-active",
      button.getAttribute("data-role-select") === roleKey
    );
  });

  const activeRole = getEditingLoadout()?.roles?.[roleKey] || role;
  if (roleTitle) roleTitle.textContent = role.title;
  if (roleLlm) roleLlm.value = activeRole.llm;
  if (roleTemperature) roleTemperature.value = activeRole.temperature;
  if (roleTopP) roleTopP.value = activeRole.topP;
  if (roleMaxTokens) roleMaxTokens.value = activeRole.maxTokens;
  if (roleInstructions) roleInstructions.value = activeRole.instructions;
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
  if (!isLoadoutMenuOpen || !selectedLoadoutButton || !loadoutSwitchMenu) {
    return;
  }

  const target = event.target;
  if (
    target instanceof Node &&
    !selectedLoadoutButton.contains(target) &&
    !loadoutSwitchMenu.contains(target)
  ) {
    setLoadoutMenuOpen(false);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && isLoadoutMenuOpen) {
    setLoadoutMenuOpen(false);
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
