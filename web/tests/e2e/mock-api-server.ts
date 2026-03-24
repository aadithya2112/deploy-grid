import { createServer, type IncomingMessage, type ServerResponse } from "node:http"

interface ProjectSnapshot {
  id: string
  slug: string
  name: string
  repoUrl: string
  defaultBranch: string
  rootDirectory: string | null
  installCommand: string | null
  buildCommand: string | null
  outputDirectory: string | null
  createdAt: string
  updatedAt: string
}

interface DeploymentSnapshot {
  id: string
  projectId: string
  repoUrl: string
  gitRef: string
  status: "queued" | "building" | "ready" | "failed" | "cancelled"
  commitSha: string | null
  previewUrl: string | null
  artifactUrl: string | null
  buildStartedAt: string | null
  buildFinishedAt: string | null
  createdAt: string
  updatedAt: string
  errorMessage: string | null
}

interface DeploymentLogEntry {
  id: string
  deploymentId: string
  stream: "stdout" | "stderr" | "system"
  sequence: number
  message: string
  createdAt: string
}

const port = 4010
const now = () => new Date().toISOString()

let projectCounter = 1
let deploymentCounter = 1

const projects = new Map<string, ProjectSnapshot>()
const deployments = new Map<string, DeploymentSnapshot>()
const deploymentLogs = new Map<string, DeploymentLogEntry[]>()

const seededProject: ProjectSnapshot = {
  id: "project-ready",
  slug: "project-ready",
  name: "Ready App",
  repoUrl: "https://github.com/acme/ready-app.git",
  defaultBranch: "main",
  rootDirectory: null,
  installCommand: null,
  buildCommand: null,
  outputDirectory: null,
  createdAt: now(),
  updatedAt: now(),
}

const seededDeployment: DeploymentSnapshot = {
  id: "deployment-ready",
  projectId: seededProject.id,
  repoUrl: seededProject.repoUrl,
  gitRef: "main",
  status: "ready",
  commitSha: "abc123def456",
  previewUrl: "https://preview.example.com/deployment-ready",
  artifactUrl: "https://artifacts.example.com/deployment-ready",
  buildStartedAt: now(),
  buildFinishedAt: now(),
  createdAt: now(),
  updatedAt: now(),
  errorMessage: null,
}

projects.set(seededProject.id, seededProject)
deployments.set(seededDeployment.id, seededDeployment)
deploymentLogs.set(seededDeployment.id, [
  {
    id: "log-ready-1",
    deploymentId: seededDeployment.id,
    stream: "system",
    sequence: 1,
    message: "deployment ready",
    createdAt: now(),
  },
])

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    "content-type": "application/json",
  })
  response.end(JSON.stringify(body))
}

async function parseJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Uint8Array[] = []

  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
  }

  const body = Buffer.concat(chunks).toString("utf8")
  return body ? (JSON.parse(body) as Record<string, unknown>) : {}
}

const server = createServer(async (request, response) => {
  if (!request.url || !request.method) {
    sendJson(response, 400, { error: "Invalid request" })
    return
  }

  const url = new URL(request.url, `http://127.0.0.1:${port}`)

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, { status: "ok", database: "ok" })
    return
  }

  if (request.method === "GET" && url.pathname === "/projects") {
    sendJson(response, 200, {
      projects: Array.from(projects.values()),
      pageInfo: {
        limit: 20,
        offset: 0,
        hasMore: false,
        nextOffset: null,
      },
    })
    return
  }

  if (request.method === "POST" && url.pathname === "/projects") {
    const body = await parseJson(request)
    const id = `project-created-${projectCounter++}`
    const project: ProjectSnapshot = {
      id,
      slug: id,
      name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : id,
      repoUrl: String(body.repoUrl),
      defaultBranch:
        typeof body.defaultBranch === "string" && body.defaultBranch.trim()
          ? body.defaultBranch.trim()
          : "main",
      rootDirectory: typeof body.rootDirectory === "string" ? body.rootDirectory : null,
      installCommand:
        typeof body.installCommand === "string" ? body.installCommand : null,
      buildCommand: typeof body.buildCommand === "string" ? body.buildCommand : null,
      outputDirectory:
        typeof body.outputDirectory === "string" ? body.outputDirectory : null,
      createdAt: now(),
      updatedAt: now(),
    }

    projects.set(project.id, project)
    sendJson(response, 201, project)
    return
  }

  const createDeploymentMatch = /^\/projects\/([^/]+)\/deployments$/.exec(url.pathname)
  if (request.method === "POST" && createDeploymentMatch) {
    const [, projectId] = createDeploymentMatch
    const project = projectId ? projects.get(projectId) : null

    if (!project) {
      sendJson(response, 404, { error: "Project not found" })
      return
    }

    const body = await parseJson(request)
    const deploymentId = `deployment-created-${deploymentCounter++}`
    const deployment: DeploymentSnapshot = {
      id: deploymentId,
      projectId: project.id,
      repoUrl: project.repoUrl,
      gitRef:
        typeof body.gitRef === "string" && body.gitRef.trim()
          ? body.gitRef.trim()
          : project.defaultBranch,
      status: "building",
      commitSha: null,
      previewUrl: null,
      artifactUrl: null,
      buildStartedAt: now(),
      buildFinishedAt: null,
      createdAt: now(),
      updatedAt: now(),
      errorMessage: null,
    }

    deployments.set(deployment.id, deployment)
    deploymentLogs.set(deployment.id, [
      {
        id: `${deployment.id}-log-1`,
        deploymentId: deployment.id,
        stream: "system",
        sequence: 1,
        message: "repository cloned",
        createdAt: now(),
      },
      {
        id: `${deployment.id}-log-2`,
        deploymentId: deployment.id,
        stream: "stdout",
        sequence: 2,
        message: "build running",
        createdAt: now(),
      },
    ])

    sendJson(response, 202, deployment)
    return
  }

  const deploymentMatch = /^\/deployments\/([^/]+)$/.exec(url.pathname)
  if (request.method === "GET" && deploymentMatch) {
    const [, deploymentId] = deploymentMatch
    const deployment = deploymentId ? deployments.get(deploymentId) : null

    if (!deployment) {
      sendJson(response, 404, { error: "Deployment not found" })
      return
    }

    sendJson(response, 200, deployment)
    return
  }

  const logsMatch = /^\/deployments\/([^/]+)\/logs$/.exec(url.pathname)
  if (request.method === "GET" && logsMatch) {
    const [, deploymentId] = logsMatch
    const logs = deploymentId ? deploymentLogs.get(deploymentId) ?? [] : []
    const afterSequence = Number(url.searchParams.get("afterSequence") ?? "-1")

    sendJson(response, 200, {
      deploymentId,
      logs: logs.filter((entry) => entry.sequence > afterSequence),
    })
    return
  }

  sendJson(response, 404, { error: "Not found" })
})

server.listen(port, "127.0.0.1", () => {
  console.log(`Mock API listening on http://127.0.0.1:${port}`)
})
