const DEFAULT_CHARACTER_IMAGE = "assets/character-1.png";
const CHARACTER_API = "http://127.0.0.1:4317/api";

const pageType = document.body.dataset.page || "home";

const overlays = Array.from(document.querySelectorAll(".editor-overlay"));
const defaultSurface = document.getElementById("default-surface");
const messageEditButtons = Array.from(
  document.querySelectorAll(".message-edit-button")
);

const roleButtons = Array.from(document.querySelectorAll("[data-role-select]"));
const roleTitle = document.getElementById("loadout-role-title");
const roleLlm = document.getElementById("editor-role-llm");
const roleTemperature = document.getElementById("editor-temperature");
const roleTopP = document.getElementById("editor-top-p");
const roleMaxTokens = document.getElementById("editor-max-tokens");
const roleInstructions = document.getElementById("editor-role-instructions");
const defaultInstructions = document.getElementById("editor-default-instructions");

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
const characterDialogueInput = document.getElementById("editor-character-dialogue");

const selectedCharacterName = document.getElementById("selected-character-name");
const selectedCharacterImage = document.getElementById("selected-character-image");
const chatCharacterSubtitle = document.getElementById("chat-character-subtitle");
const primaryCharacterLabel = document.getElementById("primary-character-label");
const secondaryCharacterLabel = document.getElementById("secondary-character-label");
const characterDrivenAvatars = Array.from(
  document.querySelectorAll(".character-driven-avatar")
);

const roleData = {
  mind: {
    title: "Mind Model",
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
    title: "Author Model",
    llm: "gpt-oss-prose",
    temperature: "1.12",
    topP: "0.96",
    maxTokens: "3072",
    instructions:
      "Write the final visible response in the selected character voice, keep rhythm and tone coherent, and turn planner output into polished dialogue.",
    defaults:
      "Respect safety boundaries, maintain continuity with prior turns, and never break the framing of the current scene unless instructed.",
  },
  stat: {
    title: "Stat Model",
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
    title: "Event Model",
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
    title: "Goal Model",
    llm: "gpt-oss-planner",
    temperature: "0.64",
    topP: "0.85",
    maxTokens: "1536",
    instructions:
      "Track character motivations, evaluate short-term objectives, and suggest next-scene priorities based on the current state.",
    defaults:
      "Preserve long-term consistency, avoid contradictory motivations, and make goals legible to the other specialist models.",
  },
};

let characters = [];
let selectedCharacterId = null;
let editingCharacterId = null;
let characterDirectory = "";

function setCharacterFileStatus(message) {
  if (characterFileStatus) {
    characterFileStatus.textContent = message;
  }
}

function makeCharacterId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `character-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createCharacterTemplate(index = 1) {
  return {
    id: makeCharacterId(),
    name: `Character ${index}`,
    nickname: `Character ${index}`,
    image: DEFAULT_CHARACTER_IMAGE,
    description: "",
    dialogue: "",
    fileName: null,
  };
}

function normalizeCharacter(character) {
  return {
    id: character?.id || makeCharacterId(),
    name: (character?.name || "Untitled Character").trim(),
    nickname: (character?.nickname || character?.name || "Character").trim(),
    image: (character?.image || DEFAULT_CHARACTER_IMAGE).trim(),
    description: character?.description ?? "",
    dialogue: character?.dialogue ?? "",
    fileName: character?.fileName || null,
  };
}

function getCharacterById(id) {
  return characters.find((character) => character.id === id) ?? null;
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
  const name = characterNameInput.value.trim() || "Untitled Character";
  const nickname = characterNicknameInput.value.trim() || name;

  return {
    name,
    nickname,
    image: getEditingCharacter()?.image?.trim() || DEFAULT_CHARACTER_IMAGE,
    description: characterDescriptionInput.value,
    dialogue: characterDialogueInput.value,
  };
}

function syncCharacterUI() {
  const character = getSelectedCharacter();

  if (!character) {
    if (selectedCharacterName) {
      selectedCharacterName.textContent = "No Character";
    }
    if (chatCharacterSubtitle) {
      chatCharacterSubtitle.textContent = "No Character";
    }
    if (primaryCharacterLabel) {
      primaryCharacterLabel.textContent = "Character";
    }
    if (secondaryCharacterLabel) {
      secondaryCharacterLabel.textContent = "Character";
    }
    applyCharacterImage(selectedCharacterImage, DEFAULT_CHARACTER_IMAGE, "Character portrait");
    characterDrivenAvatars.forEach((avatar) => {
      applyCharacterImage(avatar, DEFAULT_CHARACTER_IMAGE, "Character avatar");
    });
    return;
  }

  const displayName = getCharacterDisplayName(character);
  const image = getCharacterImage(character);

  if (selectedCharacterName) {
    selectedCharacterName.textContent = character.name;
  }
  if (chatCharacterSubtitle) {
    chatCharacterSubtitle.textContent = displayName;
  }
  if (primaryCharacterLabel) {
    primaryCharacterLabel.textContent = displayName;
  }
  if (secondaryCharacterLabel) {
    secondaryCharacterLabel.textContent = displayName;
  }

  applyCharacterImage(selectedCharacterImage, image, `${character.name} portrait`);
  characterDrivenAvatars.forEach((avatar) => {
    applyCharacterImage(avatar, image, `${displayName} avatar`);
  });
}

function renderCharacterTileGrid() {
  if (!characterTileGrid) {
    return;
  }

  characterTileGrid.innerHTML = "";

  if (pageType === "home") {
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
      createCharacter();
    });
    characterTileGrid.appendChild(addTile);
  }

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
      fillCharacterForm(character);
      renderCharacterTileGrid();
      openEditor("character-editor");
    });

    characterTileGrid.appendChild(tile);
  });
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${CHARACTER_API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Character API request failed.");
  }

  return response.json();
}

async function loadCharactersFromPc() {
  const payload = await apiRequest("/characters", { method: "GET" });
  characters = (payload.characters || []).map((character) => normalizeCharacter(character));
  characterDirectory = payload.directory || "";

  if (characters.length === 0 && pageType === "home") {
    characters = [];
    selectedCharacterId = null;
    editingCharacterId = null;
  } else {
    selectedCharacterId =
      characters.find((character) => character.id === selectedCharacterId)?.id ||
      characters[0]?.id ||
      null;
    editingCharacterId = selectedCharacterId;
  }

  syncCharacterUI();
  renderCharacterTileGrid();
  fillCharacterForm(getSelectedCharacter());

  if (pageType === "home" && characterDirectory) {
    setCharacterFileStatus(`Characters loaded from ${characterDirectory}`);
  }
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
  characterDirectory = payload.directory || characterDirectory;

  const existingIndex = characters.findIndex((entry) => entry.id === savedCharacter.id);
  if (existingIndex >= 0) {
    characters.splice(existingIndex, 1, savedCharacter);
  } else {
    characters.push(savedCharacter);
  }

  selectedCharacterId = savedCharacter.id;
  editingCharacterId = savedCharacter.id;
  syncCharacterUI();
  renderCharacterTileGrid();
  fillCharacterForm(savedCharacter);

  if (pageType === "home") {
    setCharacterFileStatus(
      characterDirectory
        ? `Saved to ${characterDirectory}\\${savedCharacter.fileName}`
        : `Saved ${savedCharacter.fileName}`
    );
  }
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
  fillCharacterForm(getSelectedCharacter());

  if (pageType === "home") {
    setCharacterFileStatus(
      characterDirectory
        ? `Deleted ${character.fileName || character.name} from ${characterDirectory}`
        : `Deleted ${character.name}`
    );
    closeEditors();
  }
}

function createCharacter() {
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

function stopMessageEditing(message, saveChanges) {
  const body = message.querySelector(".message-body");
  const paragraph = body?.querySelector("p");
  const editor = body?.querySelector(".message-inline-editor");

  if (!body || !paragraph || !editor) {
    return;
  }

  if (saveChanges) {
    paragraph.textContent = editor.value;
  }

  editor.remove();
  paragraph.hidden = false;
  message.classList.remove("is-editing");
  message.style.minHeight = "";
}

function startMessageEditing(message) {
  const body = message.querySelector(".message-body");
  const paragraph = body?.querySelector("p");

  if (!body || !paragraph || body.querySelector(".message-inline-editor")) {
    return;
  }

  const editor = document.createElement("textarea");
  editor.className = "message-inline-editor";
  editor.value = paragraph.textContent.trim();
  editor.setAttribute("aria-label", "Edit message text");

  message.style.minHeight = `${message.offsetHeight}px`;
  paragraph.hidden = true;
  body.appendChild(editor);
  message.classList.add("is-editing");

  autosizeMessageEditor(editor);
  editor.style.minHeight = `${paragraph.offsetHeight}px`;
  editor.focus();
  editor.setSelectionRange(editor.value.length, editor.value.length);

  editor.addEventListener("input", () => {
    autosizeMessageEditor(editor);
  });

  editor.addEventListener("blur", () => {
    stopMessageEditing(message, true);
  });

  editor.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      stopMessageEditing(message, false);
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      stopMessageEditing(message, true);
    }
  });
}

function closeEditors() {
  overlays.forEach((overlay) => {
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
  });

  if (defaultSurface) {
    defaultSurface.removeAttribute("aria-hidden");
  }

  syncCharacterUI();
}

function setRole(roleKey) {
  const role = roleData[roleKey];
  if (!role) {
    return;
  }

  roleButtons.forEach((button) => {
    const isActive = button.getAttribute("data-role-select") === roleKey;
    button.classList.toggle("is-active", isActive);
  });

  if (roleTitle) {
    roleTitle.textContent = role.title;
  }
  if (roleLlm) {
    roleLlm.value = role.llm;
  }
  if (roleTemperature) {
    roleTemperature.value = role.temperature;
  }
  if (roleTopP) {
    roleTopP.value = role.topP;
  }
  if (roleMaxTokens) {
    roleMaxTokens.value = role.maxTokens;
  }
  if (roleInstructions) {
    roleInstructions.value = role.instructions;
  }
  if (defaultInstructions) {
    defaultInstructions.value = role.defaults;
  }
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

  target.classList.add("is-open");
  target.setAttribute("aria-hidden", "false");

  if (defaultSurface) {
    defaultSurface.setAttribute("aria-hidden", "true");
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

messageEditButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const message = button.closest(".message");
    if (!message) {
      return;
    }

    startMessageEditing(message);
  });
});

roleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setRole(button.getAttribute("data-role-select"));
  });
});

saveCharacterButton?.addEventListener("click", () => {
  saveCurrentCharacterToPc().catch((error) => {
    setCharacterFileStatus(error.message || "Save failed.");
  });
});

deleteCharacterButton?.addEventListener("click", () => {
  deleteCurrentCharacter().catch((error) => {
    setCharacterFileStatus(error.message || "Delete failed.");
  });
});

characterNameInput?.addEventListener("input", () => {
  updateCharacterTitles(characterNameInput.value);
});

characterImageFileInput?.addEventListener("change", async (event) => {
  const input = event.currentTarget;
  const file = input?.files?.[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const result = typeof reader.result === "string" ? reader.result : "";
    const current = getEditingCharacter();
    if (current) {
      current.image = result || DEFAULT_CHARACTER_IMAGE;
    }
    const previewName = characterNameInput?.value?.trim() || "Character";
    applyCharacterImage(
      characterPortraitPreview,
      (current?.image || DEFAULT_CHARACTER_IMAGE).trim(),
      `${previewName} portrait preview`
    );
  };
  reader.readAsDataURL(file);
});

async function initializeCharacters() {
  try {
    await loadCharactersFromPc();
  } catch (error) {
    characters = [];
    selectedCharacterId = null;
    editingCharacterId = null;
    renderCharacterTileGrid();
    syncCharacterUI();
    if (pageType === "home") {
      setCharacterFileStatus(
        "Character save service is unavailable. Start the local character server."
      );
    }
  }
}

setRole("mind");
initializeCharacters();
