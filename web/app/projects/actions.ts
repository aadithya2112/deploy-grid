"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { getAuth } from "@/lib/auth"
import { createProject, createProjectDeployment } from "@/lib/api"

function optionalText(input: FormDataEntryValue | null) {
  if (typeof input !== "string") {
    return undefined
  }

  const trimmed = input.trim()
  return trimmed.length > 0 ? trimmed : undefined
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
