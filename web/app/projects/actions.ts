"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { getAuth } from "@/lib/auth"
import {
  ApiRequestError,
  createProject,
  createProjectDeployment,
  deleteProjectEnvVar,
  redeployDeployment,
  updateProject,
  upsertProjectEnvVar,
} from "@/lib/api"

function optionalText(input: FormDataEntryValue | null) {
  if (typeof input !== "string") {
    return undefined
  }

  const trimmed = input.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function normalizeEnvTarget(
  input: FormDataEntryValue | null
): "all" | "preview" | "production" {
  if (input === "preview" || input === "production") {
    return input
  }
  return "all"
}

export async function createProjectAndDeployAction(formData: FormData) {
  const { userId } = await getAuth()

  if (!userId) {
    redirect("/sign-in")
  }

  const repoUrl = optionalText(formData.get("repoUrl"))

  if (!repoUrl) {
    return
  }

  const project = await createProject(userId, {
    repoUrl,
    name: optionalText(formData.get("name")),
    defaultBranch: optionalText(formData.get("defaultBranch")),
    rootDirectory: optionalText(formData.get("rootDirectory")) ?? null,
    installCommand: optionalText(formData.get("installCommand")) ?? null,
    buildCommand: optionalText(formData.get("buildCommand")) ?? null,
    outputDirectory: optionalText(formData.get("outputDirectory")) ?? null,
  })
  const deployment = await createProjectDeployment(userId, project.id)

  revalidatePath("/dashboard")
  revalidatePath(`/projects/${project.id}`)
  redirect(`/projects/${project.id}/deployments/${deployment.id}`)
}

export async function deployProjectAction(formData: FormData) {
  const { userId } = await getAuth()

  if (!userId) {
    redirect("/sign-in")
  }

  const projectId = optionalText(formData.get("projectId"))

  if (!projectId) {
    return
  }

  const gitRef = optionalText(formData.get("gitRef"))
  const deployment = await createProjectDeployment(userId, projectId, {
    gitRef,
  })

  revalidatePath("/dashboard")
  revalidatePath(`/projects/${projectId}`)
  redirect(`/projects/${projectId}/deployments/${deployment.id}`)
}

export async function redeployDeploymentAction(formData: FormData) {
  const { userId } = await getAuth()

  if (!userId) {
    redirect("/sign-in")
  }

  const projectId = optionalText(formData.get("projectId"))
  const deploymentId = optionalText(formData.get("deploymentId"))

  if (!projectId || !deploymentId) {
    return
  }

  const deployment = await redeployDeployment(userId, deploymentId)

  revalidatePath("/dashboard")
  revalidatePath(`/projects/${projectId}`)
  redirect(`/projects/${projectId}/deployments/${deployment.id}`)
}

export async function updateProjectSettingsAction(formData: FormData) {
  const { userId } = await getAuth()

  if (!userId) {
    redirect("/sign-in")
  }

  const projectId = optionalText(formData.get("projectId"))
  if (!projectId) {
    return
  }

  let notice = "Build settings updated"
  try {
    await updateProject(userId, projectId, {
      defaultBranch: optionalText(formData.get("defaultBranch")),
      rootDirectory: optionalText(formData.get("rootDirectory")) ?? null,
      installCommand: optionalText(formData.get("installCommand")) ?? null,
      buildCommand: optionalText(formData.get("buildCommand")) ?? null,
      outputDirectory: optionalText(formData.get("outputDirectory")) ?? null,
    })
  } catch (error) {
    notice =
      error instanceof ApiRequestError
        ? error.message
        : "Unable to update build settings"
  }

  revalidatePath("/dashboard")
  revalidatePath(`/projects/${projectId}`)
  redirect(
    `/projects/${projectId}?notice=${encodeURIComponent(notice)}#configuration`
  )
}

export async function upsertProjectEnvVarAction(formData: FormData) {
  const { userId } = await getAuth()

  if (!userId) {
    redirect("/sign-in")
  }

  const projectId = optionalText(formData.get("projectId"))
  const key = optionalText(formData.get("key"))
  const rawValue = formData.get("value")
  const value = typeof rawValue === "string" ? rawValue : ""

  if (!projectId || !key || !value) {
    return
  }

  const target = normalizeEnvTarget(formData.get("target"))
  let notice = `Saved ${key}`

  try {
    await upsertProjectEnvVar(userId, projectId, key, { value, target })
  } catch (error) {
    notice =
      error instanceof ApiRequestError
        ? error.message
        : "Unable to save environment variable"
  }

  revalidatePath(`/projects/${projectId}`)
  redirect(
    `/projects/${projectId}?notice=${encodeURIComponent(notice)}#environment`
  )
}

export async function deleteProjectEnvVarAction(formData: FormData) {
  const { userId } = await getAuth()

  if (!userId) {
    redirect("/sign-in")
  }

  const projectId = optionalText(formData.get("projectId"))
  const key = optionalText(formData.get("key"))

  if (!projectId || !key) {
    return
  }

  const target = normalizeEnvTarget(formData.get("target"))
  let notice = `Deleted ${key}`

  try {
    await deleteProjectEnvVar(userId, projectId, key, target)
  } catch (error) {
    notice =
      error instanceof ApiRequestError
        ? error.message
        : "Unable to delete environment variable"
  }

  revalidatePath(`/projects/${projectId}`)
  redirect(
    `/projects/${projectId}?notice=${encodeURIComponent(notice)}#environment`
  )
}
