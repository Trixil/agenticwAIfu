const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const HOST = "127.0.0.1";
const PORT = 4317;
const CHARACTER_DIR = path.join(__dirname, "character-library");

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

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function ensureCharacterDirectory() {
  await fs.mkdir(CHARACTER_DIR, { recursive: true });
  const files = await fs.readdir(CHARACTER_DIR);
  const jsonFiles = files.filter((file) => file.endsWith(".json"));

  if (jsonFiles.length > 0) {
    return;
  }

  await Promise.all(
    defaultCharacters.map(async (character) => {
      const fileName = sanitizeFileName(character.name);
      const fullCharacter = { ...character, fileName };
      await fs.writeFile(
        path.join(CHARACTER_DIR, fileName),
        JSON.stringify(fullCharacter, null, 2),
        "utf8"
      );
    })
  );
}

async function loadCharacters() {
  await ensureCharacterDirectory();
  const files = await fs.readdir(CHARACTER_DIR);
  const characters = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .sort((a, b) => a.localeCompare(b))
      .map(async (fileName) => {
        const raw = await fs.readFile(path.join(CHARACTER_DIR, fileName), "utf8");
        const parsed = JSON.parse(raw);
        return {
          ...parsed,
          fileName,
        };
      })
  );

  return characters;
}

async function saveCharacter(character, previousFileName) {
  await ensureCharacterDirectory();
  const fileName = sanitizeFileName(character.name);
  const payload = {
    ...character,
    fileName,
  };

  if (previousFileName && previousFileName !== fileName) {
    const oldPath = path.join(CHARACTER_DIR, previousFileName);
    await fs.rm(oldPath, { force: true });
  }

  await fs.writeFile(
    path.join(CHARACTER_DIR, fileName),
    JSON.stringify(payload, null, 2),
    "utf8"
  );

  return payload;
}

async function deleteCharacter(fileName) {
  if (!fileName) {
    throw new Error("Missing file name.");
  }

  await ensureCharacterDirectory();
  await fs.rm(path.join(CHARACTER_DIR, fileName), { force: true });
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

    sendJson(response, 404, { error: "Not found." });
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Unknown server error.",
    });
  }
});

server.listen(PORT, HOST, async () => {
  await ensureCharacterDirectory();
  console.log(`Character store running at http://${HOST}:${PORT}`);
  console.log(`Character directory: ${CHARACTER_DIR}`);
});
