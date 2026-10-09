
const USERNAME = "armeenashraf";
const API = `https://api.github.com/users/${USERNAME}/repos?per_page=100&sort=updated`;

const grid = document.querySelector("#project-grid");
const searchInput = document.querySelector("#search-input");
const categoryFilter = document.querySelector("#category-filter");
const resultCount = document.querySelector("#result-count");
const projectCount = document.querySelector("#project-count");
const emptyState = document.querySelector("#empty-state");
const errorState = document.querySelector("#error-state");

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

function getKnownProject(repo, readme = "") {
  const text = `${repo.name} ${repo.description || ""} ${readme}`;

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
  const readme = await getReadme(repo);
  const known = getKnownProject(repo, readme);

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
  const symbols = {
    web: "✳",
    javascript: "⌘",
    react: "◈",
    other: "✧"
  };

  return symbols[category] || "✧";
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

async function loadProjects() {
  grid.hidden = false;
  emptyState.hidden = true;
  errorState.hidden = true;
  grid.innerHTML = '<div class="loading-card"><span class="loader"></span> Discovering repositories...</div>';

  try {
    const response = await fetch(API);

    if (!response.ok) {
      throw new Error("GitHub API request failed");
    }

    const repos = await response.json();
    const publicRepos = repos.filter(repo => !repo.archived);

    projectCount.textContent = publicRepos.length;

    grid.innerHTML = '<div class="loading-card"><span class="loader"></span> Reading project details...</div>';

    // Readme requests run in small batches to avoid overwhelming the API.
    const results = [];

    for (let i = 0; i < publicRepos.length; i += 5) {
      const batch = publicRepos.slice(i, i + 5);
      const batchResults = await Promise.all(
        batch.map((repo, offset) => getProject(repo, i + offset))
      );
      results.push(...batchResults);
    }

    projects = results;
    renderProjects();
  } catch (error) {
    console.error(error);
    grid.hidden = true;
    errorState.hidden = false;
    resultCount.textContent = "Unable to load";
  }
}

searchInput.addEventListener("input", renderProjects);
categoryFilter.addEventListener("change", renderProjects);
document.querySelector("#retry-button").addEventListener("click", loadProjects);

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
