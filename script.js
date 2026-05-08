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

setRole("mind");
