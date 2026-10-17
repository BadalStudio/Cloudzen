
"use strict";

const KEY = "cloudzen.projects.v1";
const $ = id => document.getElementById(id);

const labels = {
  live: "Live",
  progress: "In progress",
  planned: "Planned",
  paused: "Paused"
};

const symbols = {
  Website: "W",
  "Web app": "A",
  Portfolio: "P",
  Experiment: "✳",
  Other: "◆"
};

let projects = [];
let currentView = "overview";
let toastTimer;

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function validURL(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol)
      ? url.href
      : "";
  } catch {
    return "";
  }
}

function makeID() {
  return "cz_" + Date.now().toString(36) +
    "_" + Math.random().toString(36).slice(2, 8);
}

function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    $("toast").classList.remove("show");
  }, 2500);
}

function loadProjects() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "[]");

    if (!Array.isArray(saved)) {
      throw new Error("Invalid saved data");
    }

    projects = saved
      .filter(p => p && typeof p.name === "string")
      .map(p => ({
        id: String(p.id || makeID()),
        name: String(p.name).slice(0, 70),
        type: symbols[p.type] ? p.type : "Website",
        desc: String(p.desc || "").slice(0, 240),
        status: labels[p.status] ? p.status : "planned",
        url: validURL(p.url || ""),
        repo: validURL(p.repo || ""),
        updated: Number(p.updated) || Date.now()
      }));
  } catch {
    projects = [];
    toast("Saved data could not be read. Import a backup if available.");
  }
}

function saveProjects() {
  try {
    localStorage.setItem(KEY, JSON.stringify(projects));
    render();
    return true;
  } catch {
    toast("Could not save. Browser storage may be unavailable.");
    return false;
  }
}

function dateLabel(time) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric"
  }).format(new Date(time));
}

function projectCard(project) {
  const url = validURL(project.url);
  const repo = validURL(project.repo);

  return `
    <article class="project">
      <div class="project-top">
        <div class="project-icon">
          ${escapeHTML(symbols[project.type] || "◆")}
        </div>
        <div>
          <button class="small-btn" data-action="edit"
            data-id="${escapeHTML(project.id)}">Edit</button>
          <button class="small-btn" data-action="delete"
            data-id="${escapeHTML(project.id)}">Delete</button>
        </div>
      </div>

      <h3>${escapeHTML(project.name)}</h3>
      <div class="description">
        ${escapeHTML(project.desc || project.type + " project")}
      </div>

      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px">
        <span class="badge ${escapeHTML(project.status)}">
          ${escapeHTML(labels[project.status])}
        </span>
        <span class="muted">
          ${escapeHTML(project.type)} · ${escapeHTML(dateLabel(project.updated))}
        </span>
      </div>

      <div class="project-bottom">
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          ${url
            ? `<a class="link" href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">Open site ↗</a>`
            : `<span class="muted">No live URL</span>`}
          ${repo
            ? `<a class="link" href="${escapeHTML(repo)}" target="_blank" rel="noopener noreferrer">Repository ↗</a>`
            : ""}
        </div>
        <span class="muted">Cloudzen</span>
      </div>
    </article>
  `;
}

function fillGrid(element, items, emptyText) {
  element.innerHTML = items.length
    ? items.map(projectCard).join("")
    : `
      <div class="empty">
        <div style="font-size:28px">▦</div>
        <b>${escapeHTML(emptyText)}</b>
        <p>Add a project to get started.</p>
        <button class="btn primary" data-action="add">＋ Add project</button>
      </div>
    `;
}

function render() {
  $("total").textContent = projects.length;
  $("live").textContent =
    projects.filter(p => p.status === "live").length;
  $("progress").textContent =
    projects.filter(p => p.status === "progress").length;
  $("planned").textContent =
    projects.filter(p => p.status === "planned").length;

  const recent = [...projects]
    .sort((a, b) => b.updated - a.updated)
    .slice(0, 4);

  fillGrid($("recentGrid"), recent, "No projects yet");

  const query = $("search").value.trim().toLowerCase();
  const status = $("filter").value;

  const matches = [...projects]
    .filter(project =>
      (status === "all" || project.status === status) &&
      [
        project.name, project.desc, project.type,
        project.url, project.repo
      ].some(value => String(value || "").toLowerCase().includes(query))
    )
    .sort((a, b) => b.updated - a.updated);

  fillGrid(
    $("allGrid"),
    matches,
    projects.length ? "No matching projects" : "Your workspace is empty"
  );

  $("storageInfo").textContent =
    `${projects.length} project(s) saved in this browser.`;
}

function goTo(view) {
  currentView = view;

  document.querySelectorAll(".view").forEach(element => {
    element.classList.toggle("active", element.id === "view-" + view);
  });

  document.querySelectorAll("[data-view]").forEach(button => {
    button.classList.toggle("active", button.dataset.view === view);
  });

  const titles = {
    overview: "Your control center.",
    projects: "Your projects.",
    deploy: "Deployment workflow.",
    settings: "Workspace settings."
  };

  $("pageTitle").textContent = titles[view] || "Cloudzen";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openModal(project) {
  $("form").reset();

  $("id").value = project?.id || "";
  $("modalTitle").textContent = project ? "Edit project" : "Add project";

  $("name").value = project?.name || "";
  $("type").value = project?.type || "Website";
  $("desc").value = project?.desc || "";
  $("status").value = project?.status || "planned";
  $("url").value = project?.url || "";
  $("repo").value = project?.repo || "";

  $("backdrop").classList.add("open");
  setTimeout(() => $("name").focus(), 50);
}

function closeModal() {
  $("backdrop").classList.remove("open");
}

function handleGridClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;

  if (action === "add") {
    openModal();
    return;
  }

  const project = projects.find(p => p.id === id);
  if (!project) return;

  if (action === "edit") {
    openModal(project);
  }

  if (action === "delete") {
    const confirmed = confirm(
      `Delete "${project.name}" from Cloudzen? This will not delete the actual website.`
    );

    if (!confirmed) return;

    const previous = projects;
    projects = projects.filter(p => p.id !== id);

    if (saveProjects()) {
      toast("Project removed.");
    } else {
      projects = previous;
      render();
    }
  }
}

// Navigation
document.querySelectorAll("[data-view]").forEach(button => {
  button.addEventListener("click", () => goTo(button.dataset.view));
});

document.querySelectorAll("[data-goto]").forEach(button => {
  button.addEventListener("click", () => goTo(button.dataset.goto));
});

["addTop", "heroAdd", "addProjects"].forEach(id => {
  $(id).addEventListener("click", () => openModal());
});

// Modal controls
$("close").addEventListener("click", closeModal);
$("cancel").addEventListener("click", closeModal);

$("backdrop").addEventListener("click", event => {
  if (event.target === $("backdrop")) closeModal();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeModal();
});

$("recentGrid").addEventListener("click", handleGridClick);
$("allGrid").addEventListener("click", handleGridClick);

// Search and filter
$("search").addEventListener("input", render);
$("filter").addEventListener("change", render);

// Add and edit projects
$("form").addEventListener("submit", event => {
  event.preventDefault();

  const name = $("name").value.trim();

  if (!name) {
    toast("Enter a project name.");
    return;
  }

  const rawURL = $("url").value.trim();
  const rawRepo = $("repo").value.trim();

  const url = rawURL ? validURL(rawURL) : "";
  const repo = rawRepo ? validURL(rawRepo) : "";

  if (rawURL && !url) {
    toast("Enter a valid HTTP or HTTPS website URL.");
    $("url").focus();
    return;
  }

  if (rawRepo && !repo) {
    toast("Enter a valid HTTP or HTTPS repository URL.");
    $("repo").focus();
    return;
  }

  const id = $("id").value;

  const project = {
    id: id || makeID(),
    name,
    type: $("type").value,
    desc: $("desc").value.trim(),
    status: $("status").value,
    url,
    repo,
    updated: Date.now()
  };

  const previous = projects;

  projects = id
    ? projects.map(p => p.id === id ? project : p)
    : [project, ...projects];

  if (saveProjects()) {
    closeModal();
    toast(id ? "Project updated." : "Project added.");
    goTo(currentView);
  } else {
    projects = previous;
    render();
  }
});

// Export a backup
$("export").addEventListener("click", () => {
  const backup = {
    app: "Cloudzen",
    version: 1,
    exportedAt: new Date().toISOString(),
    projects
  };

  const blob = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: "application/json" }
  );

  const objectURL = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectURL;
  link.download = "cloudzen-backup.json";
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(objectURL), 1000);
  toast("Backup exported.");
});

// Import a backup
$("import").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    if (file.size > 2000000) {
      throw new Error("Backup is too large.");
    }

    const data = JSON.parse(await file.text());
    const incoming = Array.isArray(data) ? data : data.projects;

    if (!Array.isArray(incoming)) {
      throw new Error("This is not a recognised backup.");
    }

    if (!confirm(`Import ${incoming.length} project(s)? This replaces the current list.`)) {
      return;
    }

    const cleaned = incoming
      .filter(p => p && typeof p.name === "string")
      .map(p => ({
        id: String(p.id || makeID()),
        name: p.name.slice(0, 70),
        type: symbols[p.type] ? p.type : "Website",
        desc: String(p.desc || "").slice(0, 240),
        status: labels[p.status] ? p.status : "planned",
        url: validURL(p.url || ""),
        repo: validURL(p.repo || ""),
        updated: Number(p.updated) || Date.now()
      }));

    const previous = projects;
    projects = cleaned;

    if (saveProjects()) {
      toast("Backup imported.");
    } else {
      projects = previous;
      render();
    }
  } catch (error) {
    toast(error.message || "Could not import backup.");
  } finally {
    event.target.value = "";
  }
});

// Clear local project list
$("clear").addEventListener("click", () => {
  if (!projects.length) {
    toast("No projects to clear.");
    return;
  }

  if (!confirm("Delete all projects saved in this browser? Export a backup first if needed.")) {
    return;
  }

  const previous = projects;
  projects = [];

  if (saveProjects()) {
    toast("Project list cleared.");
  } else {
    projects = previous;
    render();
  }
});

// Start the dashboard
$("year").textContent = new Date().getFullYear();
loadProjects();
render();
    
