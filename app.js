// =========================
// Config + State
// =========================
const API_BASE = "https://pokeapi.co/api/v2/pokemon/";
const TEAM_KEY = "pokedex_team_v1";

let currentPokemon = null; // last fetched pokemon (simplified)
let currentMoves = [];     // moves list for reshuffle
let team = [];             // { id, name, sprite, types[] }

// =========================
// Utilities
// =========================
function showToast(message) {
  $("#toastMsg").text(message);
  const toastEl = document.getElementById("appToast");
  const t = bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 1800 });
  t.show();
}

function setLoading(isLoading) {
  $("#loading").toggleClass("d-none", !isLoading);
  $("#searchBtn").prop("disabled", isLoading);
  $("#randomBtn").prop("disabled", isLoading);
  $("#addToTeamBtn").prop("disabled", isLoading);
}

function showError(msg) {
  $("#errorBox").removeClass("d-none").text(msg);
}

function clearError() {
  $("#errorBox").addClass("d-none").text("");
}

function capitalize(s) {
  return (s || "").charAt(0).toUpperCase() + (s || "").slice(1);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandomUnique(arr, n) {
  const copy = [...arr];
  const picked = [];
  while (copy.length && picked.length < n) {
    const idx = Math.floor(Math.random() * copy.length);
    picked.push(copy.splice(idx, 1)[0]);
  }
  return picked;
}

function typeBadgeClass(type) {
  const map = {
    fire: "text-bg-danger",
    water: "text-bg-primary",
    grass: "text-bg-success",
    electric: "text-bg-warning",
    ice: "text-bg-info",
    fighting: "text-bg-dark",
    poison: "text-bg-secondary",
    ground: "text-bg-warning",
    flying: "text-bg-info",
    psychic: "text-bg-danger",
    bug: "text-bg-success",
    rock: "text-bg-secondary",
    ghost: "text-bg-dark",
    dragon: "text-bg-primary",
    dark: "text-bg-dark",
    steel: "text-bg-secondary",
    fairy: "text-bg-danger",
    normal: "text-bg-light"
  };
  return map[type] || "text-bg-secondary";
}

// =========================
// LocalStorage
// =========================
function saveTeam() {
  localStorage.setItem(TEAM_KEY, JSON.stringify(team));
}

function loadTeam() {
  const raw = localStorage.getItem(TEAM_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) team = parsed;
  } catch {
    // ignore parse errors
  }
}

// =========================
// Render Team (jQuery DOM)
// =========================
function renderTeam() {
  $("#teamCount").text(team.length);
  const $list = $("#teamList");
  $list.empty();

  for (let i = 0; i < 6; i++) {
    const member = team[i];
    const $slot = $("<div>").addClass("team-slot");

    if (!member) {
      $slot.append($("<div>").addClass("muted").text(`Empty slot #${i + 1}`));
      $slot.append($("<span>").addClass("badge text-bg-light text-dark").text("—"));
      $list.append($slot);
      continue;
    }

    const $left = $("<div>").addClass("d-flex align-items-center gap-2");
    $left.append($("<img>").attr("src", member.sprite).attr("alt", member.name));

    const $info = $("<div>");
    $info.append($("<div>").addClass("fw-semibold capitalize").text(member.name));

    const $types = $("<div>").addClass("d-flex flex-wrap gap-1 mt-1");
    member.types.forEach(t => {
      $types.append(
        $("<span>")
          .addClass(`badge ${typeBadgeClass(t)} type-badge`)
          .text(t)
      );
    });
    $info.append($types);
    $left.append($info);

    const $btn = $("<button>")
      .addClass("btn btn-outline-danger btn-sm")
      .text("Remove")
      .on("click", () => removeFromTeam(member.id));

    $slot.append($left, $btn);
    $list.append($slot);
  }
}

function addToTeam(p) {
  if (!p) return;

  if (team.length >= 6) {
    showToast("Team is full (max 6). Remove one first.");
    return;
  }

  const exists = team.some(x => x.id === p.id);
  if (exists) {
    showToast("This Pokémon is already in your team.");
    return;
  }

  team.push({
    id: p.id,
    name: p.name,
    sprite: p.sprite,
    types: p.types
  });

  saveTeam();
  renderTeam();
  showToast(`${capitalize(p.name)} added to team!`);
}

function removeFromTeam(id) {
  team = team.filter(x => x.id !== id);
  saveTeam();
  renderTeam();
  showToast("Removed from team.");
}

function clearTeam() {
  team = [];
  saveTeam();
  renderTeam();
  showToast("Team cleared.");
}

// =========================
// Render Result
// =========================
function renderPokemon(pokemon) {
  if (!pokemon) return;

  $("#resultCard").removeClass("d-none");
  $("#pokeName").text(pokemon.name);
  $("#pokeId").text(`#${pokemon.id}`);
  $("#spriteImg").attr("src", pokemon.sprite).attr("alt", pokemon.name);

  $("#height").text(`${pokemon.height_m} m`);
  $("#weight").text(`${pokemon.weight_kg} kg`);

  // Types
  const $types = $("#typeBadges");
  $types.empty();
  pokemon.types.forEach(t => {
    $types.append(
      $("<span>")
        .addClass(`badge ${typeBadgeClass(t)} type-badge`)
        .text(t)
    );
  });

  // Stats
  const $stats = $("#statsBox");
  $stats.empty();
  pokemon.stats.forEach(s => {
    const $row = $("<div>").addClass("d-flex align-items-center gap-2");
    const $label = $("<div>").addClass("stat-label").css("width", "90px").text(s.name);

    const $barWrap = $("<div>").addClass("progress flex-grow-1").attr("style", "height: 10px;");
    const value = Math.min(s.value, 180); // clamp for UI
    const $bar = $("<div>").addClass("progress-bar").attr("style", `width:${(value / 180) * 100}%`);
    const $num = $("<div>").addClass("small fw-semibold").css("width", "36px").text(s.value);

    $barWrap.append($bar);
    $row.append($label, $barWrap, $num);
    $stats.append($row);
  });

  // Moves
  currentMoves = pokemon.moves;
  renderMovesSample();
}

function renderMovesSample() {
  const sample = pickRandomUnique(currentMoves, 6);
  const $moves = $("#movesBox");
  $moves.empty();

  if (!sample.length) {
    $moves.append($("<li>").addClass("muted").text("No moves found."));
    return;
  }

  sample.forEach(m => $moves.append($("<li>").text(m)));
}

function clearResult() {
  currentPokemon = null;
  currentMoves = [];
  $("#resultCard").addClass("d-none");
  $("#searchInput").val("");
  clearError();
}

// =========================
// Fetch Pokémon (AJAX via fetch)
// =========================
async function fetchPokemon(query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) {
    showError("Please enter a Pokémon name or ID.");
    return;
  }

  clearError();
  setLoading(true);

  try {
    const res = await fetch(API_BASE + encodeURIComponent(q));
    if (!res.ok) throw new Error("Not found. Try a valid name or ID (e.g., pikachu or 25).");
    const data = await res.json();

    const sprite =
      data.sprites?.front_default ||
      data.sprites?.other?.["official-artwork"]?.front_default ||
      "";

    const types = (data.types || []).map(t => t.type.name);
    const stats = (data.stats || []).map(s => ({ name: s.stat.name, value: s.base_stat }));
    const moves = (data.moves || []).map(m => m.move.name);

    // height/weight are decimeters/hectograms
    const pokemon = {
      id: data.id,
      name: data.name,
      sprite,
      types,
      height_m: (data.height / 10).toFixed(1),
      weight_kg: (data.weight / 10).toFixed(1),
      stats,
      moves
    };

    currentPokemon = pokemon;
    renderPokemon(pokemon);
    showToast(`${capitalize(pokemon.name)} loaded!`);
  } catch (err) {
    showError(err.message || "Something went wrong.");
  } finally {
    setLoading(false);
  }
}

// =========================
// Export Team JSON
// =========================
function exportTeamJSON() {
  const blob = new Blob([JSON.stringify(team, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "team.json";
  a.click();
  URL.revokeObjectURL(url);
}

// =========================
// jQuery Event Binding
// =========================
$(document).ready(function () {
  // load saved team
  loadTeam();
  renderTeam();

  // search
  $("#searchBtn").on("click", () => fetchPokemon($("#searchInput").val()));

  // Enter triggers search
  $("#searchInput").on("keydown", (e) => {
    if (e.key === "Enter") fetchPokemon($("#searchInput").val());
  });

  // random
  $("#randomBtn").on("click", () => {
    const id = randomInt(1, 1025);
    fetchPokemon(String(id));
  });

  // clear result
  $("#clearResultBtn").on("click", clearResult);

  // add to team
  $("#addToTeamBtn").on("click", () => addToTeam(currentPokemon));

  // reshuffle moves
  $("#reshuffleMovesBtn").on("click", renderMovesSample);

  // clear team
  $("#clearTeamBtn").on("click", clearTeam);

  // export json
  $("#exportTeamBtn").on("click", exportTeamJSON);
});
