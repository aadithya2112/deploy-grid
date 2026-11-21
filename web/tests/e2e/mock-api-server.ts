import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http"

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
const projectEnvVars = new Map<
  string,
  {
    id: string
    projectId: string
    key: string
    target: "all" | "preview" | "production"
    maskedValue: string
    createdAt: string
    updatedAt: string
  }[]
>()

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

async function parseJson(
  request: IncomingMessage
): Promise<Record<string, unknown>> {
  const chunks: Uint8Array[] = []

  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
  }

  const body = Buffer.concat(chunks).toString("utf8")
  return body ? (JSON.parse(body) as Record<string, unknown>) : {}
}

const managedProject = {
  ...seededProject,
  id: "12345678-1234-1234-1234-123456789012",
  name: "Managed App",
}
projects.set(managedProject.id, managedProject)
const managedDeployment = {
  ...seededDeployment,
  id: "22345678-1234-1234-1234-123456789012",
  projectId: managedProject.id,
}
deployments.set(managedDeployment.id, managedDeployment)
let liveDeployment: string | null = null

const server = createServer(async (request, response) => {
  if (!request.url || !request.method) {
    sendJson(response, 400, { error: "Invalid request" })
    return
  }

  const url = new URL(request.url, `http://127.0.0.1:${port}`)

  if (url.pathname === `/projects/${managedProject.id}/platform`) {
    sendJson(response, 200, {
      release: {
        deploymentId: liveDeployment,
        repository: null,
        installationId: null,
      },
      productionUrl: "https://production.example.com",
      history: [],
      builds: [
        {
          id: managedDeployment.id,
          environment: "preview",
          framework: "react-vite",
          metrics: { totalMs: 1000 },
          pullRequest: null,
          expiresAt: null,
          deletedAt: null,
        },
      ],
    })
    return
  }
  if (
    request.method === "POST" &&
    url.pathname === `/projects/${managedProject.id}/promote`
  ) {
    const body = await parseJson(request)
    liveDeployment = String(body.deploymentId)
    sendJson(response, 200, { deploymentId: liveDeployment })
    return
  }
  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, { status: "ok", database: "ok" })
    return
  }

  if (request.method === "GET" && url.pathname === "/projects") {
    const query = (url.searchParams.get("query") ?? "").toLowerCase()
    sendJson(response, 200, {
      projects: Array.from(projects.values()).filter((project) =>
        `${project.name} ${project.repoUrl}`.toLowerCase().includes(query)
      ),
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
      name:
        typeof body.name === "string" && body.name.trim()
          ? body.name.trim()
          : id,
      repoUrl: String(body.repoUrl),
      defaultBranch:
        typeof body.defaultBranch === "string" && body.defaultBranch.trim()
          ? body.defaultBranch.trim()
          : "main",
      rootDirectory:
        typeof body.rootDirectory === "string" ? body.rootDirectory : null,
      installCommand:
        typeof body.installCommand === "string" ? body.installCommand : null,
      buildCommand:
        typeof body.buildCommand === "string" ? body.buildCommand : null,
      outputDirectory:
        typeof body.outputDirectory === "string" ? body.outputDirectory : null,
      createdAt: now(),
      updatedAt: now(),
    }

    projects.set(project.id, project)
    sendJson(response, 201, project)
    return
  }

  const projectRead = /^\/projects\/([^/]+)(?:\/(deployments|env-vars))?$/.exec(
    url.pathname
  )
  if (request.method === "GET" && projectRead) {
    const project = projects.get(projectRead[1]!)
    if (!project) {
      sendJson(response, 404, { error: "Project not found" })
      return
    }
    if (projectRead[2] === "deployments")
      sendJson(response, 200, {
        deployments: Array.from(deployments.values())
          .filter((item) => item.projectId === project.id)
          .reverse(),
        projectId: project.id,
        pageInfo: { limit: 20, offset: 0, hasMore: false, nextOffset: null },
      })
    else if (projectRead[2] === "env-vars")
      sendJson(response, 200, {
        projectId: project.id,
        envVars: projectEnvVars.get(project.id) ?? [],
      })
    else sendJson(response, 200, project)
    return
  }

  const projectPatch = /^\/projects\/([^/]+)$/.exec(url.pathname)
  if (request.method === "PATCH" && projectPatch) {
    const project = projects.get(projectPatch[1]!)
    if (!project) {
      sendJson(response, 404, { error: "Project not found" })
      return
    }
    const body = await parseJson(request)
    const updated: ProjectSnapshot = {
      ...project,
      defaultBranch:
        typeof body.defaultBranch === "string" && body.defaultBranch.trim()
          ? body.defaultBranch.trim()
          : project.defaultBranch,
      rootDirectory:
        body.rootDirectory === undefined
          ? project.rootDirectory
          : typeof body.rootDirectory === "string"
            ? body.rootDirectory
            : null,
      installCommand:
        body.installCommand === undefined
          ? project.installCommand
          : typeof body.installCommand === "string"
            ? body.installCommand
            : null,
      buildCommand:
        body.buildCommand === undefined
          ? project.buildCommand
          : typeof body.buildCommand === "string"
            ? body.buildCommand
            : null,
      outputDirectory:
        body.outputDirectory === undefined
          ? project.outputDirectory
          : typeof body.outputDirectory === "string"
            ? body.outputDirectory
            : null,
      updatedAt: now(),
    }
    projects.set(project.id, updated)
    sendJson(response, 200, updated)
    return
  }

  const envVarRoute = /^\/projects\/([^/]+)\/env-vars\/([^/]+)$/.exec(
    url.pathname
  )
  if (envVarRoute) {
    const projectId = envVarRoute[1]!
    const key = decodeURIComponent(envVarRoute[2]!)
    const project = projects.get(projectId)
    if (!project) {
      sendJson(response, 404, { error: "Project not found" })
      return
    }
    const existing = projectEnvVars.get(projectId) ?? []
    if (request.method === "PUT") {
      const body = await parseJson(request)
      const target: "all" | "preview" | "production" =
        body.target === "preview" || body.target === "production"
          ? body.target
          : "all"
      const value = String(body.value ?? "")
      const record = {
        id: `${projectId}-${key}-${target}`,
        projectId,
        key,
        target,
        maskedValue: `****${value.slice(-4)}`,
        createdAt: now(),
        updatedAt: now(),
      }
      const next = [
        ...existing.filter((item) => !(item.key === key && item.target === target)),
        record,
      ]
      projectEnvVars.set(projectId, next)
      sendJson(response, 201, record)
      return
    }
    if (request.method === "DELETE") {
      const target = url.searchParams.get("target") ?? "all"
      projectEnvVars.set(
        projectId,
        existing.filter((item) => !(item.key === key && item.target === target))
      )
      response.writeHead(204)
      response.end()
      return
    }
  }

  const redeployMatch = /^\/deployments\/([^/]+)\/redeploy$/.exec(url.pathname)
  if (request.method === "POST" && redeployMatch) {
    const source = deployments.get(redeployMatch[1]!)
    if (!source) {
      sendJson(response, 404, { error: "Deployment not found" })
      return
    }
    const deploymentId = `deployment-created-${deploymentCounter++}`
    const redeployed: DeploymentSnapshot = {
      ...source,
      id: deploymentId,
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
    deployments.set(redeployed.id, redeployed)
    deploymentLogs.set(redeployed.id, [
      {
        id: `${redeployed.id}-log-1`,
        deploymentId: redeployed.id,
        stream: "system",
        sequence: 1,
        message: "redeploy queued",
        createdAt: now(),
      },
    ])
    sendJson(response, 202, redeployed)
    return
  }

  const createDeploymentMatch = /^\/projects\/([^/]+)\/deployments$/.exec(
    url.pathname
  )
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
    const logs = deploymentId ? (deploymentLogs.get(deploymentId) ?? []) : []
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
