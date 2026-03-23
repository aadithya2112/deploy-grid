function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\.git$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function hashString(value: string): string {
  let hash = 0;

  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return hash.toString(36);
}

export function deriveProjectMetadata(repoUrl: string): {
  name: string;
  slug: string;
} {
  let repoName = "react-app";

  try {
    const pathname = new URL(repoUrl).pathname;
    const parts = pathname.split("/").filter(Boolean);
    repoName = decodeURIComponent(parts.at(-1) ?? "").replace(/\.git$/, "");
    repoName = repoName || "react-app";
  } catch {
    repoName = repoUrl.split("/").filter(Boolean).at(-1) ?? repoName;
    repoName = repoName.replace(/\.git$/, "");
  }

  const baseName = repoName || "react-app";
  const slugBase = slugify(baseName) || "react-app";

  return {
    name: baseName,
    slug: `${slugBase}-${hashString(repoUrl).slice(0, 6)}`,
  };
}
