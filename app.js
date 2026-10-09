const USERNAME = "armeenashraf";
const API = `https://api.github.com/users/${USERNAME}/repos?per_page=100&sort=updated`;
const CACHE_KEY = "gh-projects-v2";
const CACHE_MS = 60 * 60 * 1000; // 1 hour

const $ = selector => document.querySelector(selector);

const grid = $("#project-grid");
const searchInput = $("#search-input");
const categoryFilter = $("#category-filter");
const resultCount = $("#result-count");
const projectCount = $("#project-count");
const emptyState = $("#empty-state");
const errorState = $("#error-state");
const retryButton = $("#retry-button");

// Fail loudly if the HTML is missing an element, instead of a silent blank page
const required = { grid, searchInput, categoryFilter, resultCount, emptyState, errorState };
const missing = Object.keys(required).filter(key => !required[key]);
if (missing.length) {
  throw new Error(`Missing elements in HTML: ${missing.join(", ")}`);
}

let projects = [];

const knownProjects = [
  {
    match: /drop.?your.?files/i,
    title: "Drop Your Files",
    description: "A simple file-sharing website for sharing files online.",
    demo: "https://drop-your-files.netlify.app/",
    category: "web"
  },
  {
    match: /student.?portal/i,
    title: "NovaLearn Student Portal",
    description: "A student portal for learning resources, assignments and student progress.",
    demo: "https://nova-learn-portal.netlify.app/",
    category: "web"
  },
  {
    match: /food.?website|food.?ordering/i,
    title: "Food Ordering Website",
    description: "An online food ordering experience with menu categories and a shopping cart.",
    demo: "https://order-delicious-food-now.netlify.app/",
    category: "web"
  },
  {
    match: /customer.?services.?provider|quick.?serve|fem.?hack/i,
    title: "Customer Services Provider",
    description: "A service-booking platform connecting customers with service providers.",
    demo: "https://customer-services-provider.netlify.app/",
    category: "web"
  },
  {
    match: /waveline/i,
    title: "Waveline Music Player",
    description: "A music player concept with playback controls, themes and listening features.",
    category: "web"
  },
  {
    match: /maison.?resume|resume.?builder/i,
    title: "Maison Résumé",
    description: "A resume builder with customizable templates and export options.",
    category: "web"
  },
  {
    match: /droply/i,
    title: "Droply — Share Anything",
    description: "A file and text-sharing app with sharing links and access-code features.",
    category: "web"
  },
  {
    match: /frosty.?bliss/i,
    title: "Frosty Bliss",
    description: "An ice cream website with a playful dessert-inspired design.",
    category: "web"
  },
  {
    match: /prime.?wheelz/i,
    title: "PrimeWheelz",
    description: "A car-themed website with a bold automotive design.",
    category: "web"
  },
  {
    match: /velvet.?sip/i,
    title: "Velvet Sip",
    description: "A cafe website with a warm, elegant visual style.",
    category: "web"
  },
  {
    match: /elite.?haven/i,
    title: "EliteHaven",
    description: "A hotel website concept with a refined hospitality-inspired layout.",
    category: "web"
  }
];

/* ---------- helpers ---------- */

function cleanText(text = "") {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_>#~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeBase64(value = "") {
  try {
    const bytes = Uint8Array.from(atob(value.replace(/\s/g, "")), char =>
      char.charCodeAt(0)
    );
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

// FIX: match on the repo name and description only, NOT the README,
// so a README that merely mentions "droply" can't rename another repo.
function getKnownProject(repo) {
  const text = `${repo.name} ${repo.description || ""}`;
  return knownProjects.find(project => project.match.test(text));
}

function getReadmeTitle(readme = "") {
  const headings = readme.match(/^#\s+(.+)$/gm) || [];

  for (const heading of headings) {
    const title = cleanText(heading.replace(/^#\s+/, ""));
    if (
      title &&
      !/^(readme|description|features|installation|getting started|about)$/i.test(title)
    ) {
      return title;
    }
  }

  return "";
}

function getReadmeDescription(readme = "") {
  const lines = readme.split("\n");
  let started = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("```")) {
      if (started && trimmed.startsWith("#")) break;
      continue;
    }

    if (
      trimmed.startsWith("![") ||
      trimmed.startsWith("<") ||
      trimmed.startsWith("|") ||
      trimmed.startsWith("---")
    ) {
      continue;
    }

    const description = cleanText(trimmed);

    if (description.length > 25) {
      return description.length > 180
        ? `${description.slice(0, 177).trim()}...`
        : description;
    }

    started = true;
  }

  return "";
}

function formatRepoName(name = "") {
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase());
}

function getCategory(repo, readme = "") {
  const text = `${repo.name} ${repo.description || ""} ${readme}`.toLowerCase();

  if (/\breact\b/.test(text)) return "react";
  if (/javascript|calculator|counter|generator|music player|quiz/.test(text)) {
    return "javascript";
  }
  if (/html|css|website|portfolio|app|web|tailwind/.test(text)) {
    return "web";
  }

  return "other";
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function getSymbol(category) {
  const symbols = { web: "✳", javascript: "⌘", react: "◈", other: "✧" };
  return symbols[category] || "✧";
}

/* ---------- GitHub requests ---------- */

async function getReadme(repo) {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${USERNAME}/${encodeURIComponent(repo.name)}/readme`,
      { headers: { Accept: "application/vnd.github+json" } }
    );

    if (!response.ok) return "";

    const data = await response.json();
    return decodeBase64(data.content || "");
  } catch {
    return "";
  }
}

async function getProject(repo, index) {
  const known = getKnownProject(repo);

  // FIX: only spend an API request on the README when we truly need it.
  // This cuts ~58 requests down to a handful and avoids the rate limit.
  const needsReadme = !known && !repo.description;
  const readme = needsReadme ? await getReadme(repo) : "";

  const title = known?.title || getReadmeTitle(readme) || formatRepoName(repo.name);
  const description =
    known?.description ||
    repo.description ||
    getReadmeDescription(readme) ||
    "This repository does not have a clear project description yet.";

  return {
    id: repo.id,
    number: String(index + 1).padStart(2, "0"),
    title,
    description,
    repoUrl: repo.html_url,
    demo: known?.demo || repo.homepage || "",
    stars: repo.stargazers_count || 0,
    forks: repo.forks_count || 0,
    updated: repo.updated_at,
    category: known?.category || getCategory(repo, readme),
    topics: (repo.topics || []).slice(0, 3),
    isFork: repo.fork
  };
}

/* ---------- cache ---------- */

function readCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (cached && Array.isArray(cached.data) && Date.now() - cached.t < CACHE_MS) {
      return cached.data;
    }
  } catch {}
  return null;
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), data }));
  } catch {}
}

/* ---------- rendering ---------- */

function setCount(n) {
  if (projectCount) projectCount.textContent = n;
}

function renderProjects() {
  const query = searchInput.value.toLowerCase().trim();
  const category = categoryFilter.value;

  const filtered = projects.filter(project => {
    const searchable = [
      project.title,
      project.description,
      project.category,
      project.topics.join(" ")
    ].join(" ").toLowerCase();

    return searchable.includes(query) &&
      (category === "all" || project.category === category);
  });

  resultCount.textContent = `${filtered.length} project${filtered.length === 1 ? "" : "s"}`;

  emptyState.hidden = filtered.length !== 0;
  grid.hidden = filtered.length === 0;

  grid.innerHTML = filtered.map((project, index) => `
    <article class="project-card" style="animation-delay:${Math.min(index * 45, 350)}ms">
      <div class="card-top">
        <span class="project-number">PROJECT / ${project.number}</span>
        <span class="project-symbol">${getSymbol(project.category)}</span>
      </div>

      <h3>${escapeHTML(project.title)}</h3>
      <p class="project-description">${escapeHTML(project.description)}</p>

      <div class="tech-list">
        <span class="tech-tag">${escapeHTML(project.category)}</span>
        ${project.topics.map(topic =>
          `<span class="tech-tag">${escapeHTML(topic)}</span>`
        ).join("")}
      </div>

      <div class="card-bottom">
        <div class="repo-meta">
          <span>☆ ${project.stars}</span>
          <span>⑂ ${project.forks}</span>
        </div>

        <div class="card-links">
          ${project.demo ? `
            <a class="card-link demo-link" href="${escapeHTML(project.demo)}"
               target="_blank" rel="noreferrer">Live demo ↗</a>
          ` : ""}
          <a class="card-link" href="${escapeHTML(project.repoUrl)}"
             target="_blank" rel="noreferrer">Source ↗</a>
        </div>
      </div>
    </article>
  `).join("");
}

function showError(error) {
  grid.hidden = true;
  emptyState.hidden = true;
  errorState.hidden = false;
  resultCount.textContent = "Unable to load";

  // FIX: show the real reason on the page, not just in the console
  let reason = error.message || "Unknown error";
  if (error.name === "AbortError") {
    reason = "GitHub took too long to respond (15 seconds). Please retry.";
  } else if (/403|rate limit/i.test(reason)) {
    reason = "GitHub's hourly request limit was reached. Please try again in a while.";
  } else if (/Failed to fetch|NetworkError/i.test(reason)) {
    reason = "The request to GitHub was blocked or you are offline. If this page is hosted somewhere that blocks outside requests, GitHub cannot be reached.";
  }

  let detail = errorState.querySelector("[data-error-detail]");
  if (!detail) {
    detail = document.createElement("p");
    detail.setAttribute("data-error-detail", "");
    errorState.appendChild(detail);
  }
  detail.textContent = reason;
}

/* ---------- main loader ---------- */

async function loadProjects({ force = false } = {}) {
  grid.hidden = false;
  emptyState.hidden = true;
  errorState.hidden = true;

  if (!force) {
    const cached = readCache();
    if (cached) {
      projects = cached;
      setCount(projects.length);
      renderProjects();
      return;
    }
  }

  grid.innerHTML = `
    <div class="loading-card">
      <span class="loader"></span>
      Connecting to GitHub...
    </div>
  `;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(API, {
      headers: { Accept: "application/vnd.github+json" },
      signal: controller.signal
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`GitHub API returned ${response.status}: ${details}`);
    }

    const repos = await response.json();

    if (!Array.isArray(repos)) {
      throw new Error("GitHub returned an unexpected response.");
    }

    const publicRepos = repos.filter(repo => !repo.archived);
    setCount(publicRepos.length);

    grid.innerHTML = `
      <div class="loading-card">
        <span class="loader"></span>
        Preparing projects...
      </div>
    `;

    const results = [];

    for (let i = 0; i < publicRepos.length; i += 5) {
      const batch = publicRepos.slice(i, i + 5);

      const batchResults = await Promise.all(
        batch.map((repo, offset) => getProject(repo, i + offset))
      );

      results.push(...batchResults);
    }

    projects = results;
    writeCache(results);
    renderProjects();

  } catch (error) {
    console.error("Project loading failed:", error);

    // If GitHub fails but we have an older cache, still show that
    try {
      const stale = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (stale && Array.isArray(stale.data) && stale.data.length) {
        projects = stale.data;
        setCount(projects.length);
        renderProjects();
        return;
      }
    } catch {}

    showError(error);

  } finally {
    clearTimeout(timeout);
  }
}

/* ---------- events ---------- */

searchInput.addEventListener("input", renderProjects);
categoryFilter.addEventListener("change", renderProjects);
if (retryButton) retryButton.addEventListener("click", () => loadProjects({ force: true }));

document.addEventListener("keydown", event => {
  if (
    event.key === "/" &&
    !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)
  ) {
    event.preventDefault();
    searchInput.focus();
  }

  if (event.key === "Escape") {
    searchInput.value = "";
    searchInput.blur();
    renderProjects();
  }
});

loadProjects();