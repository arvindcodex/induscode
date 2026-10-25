import * as vscode from "vscode"
import { ExtensionRegistryInfo } from "@/registry"
import { OpenIndusCodeSidebarPanelRequest, OpenIndusCodeSidebarPanelResponse } from "@/shared/proto/index.host"

export async function openIndusCodeSidebarPanel(_: OpenIndusCodeSidebarPanelRequest): Promise<OpenIndusCodeSidebarPanelResponse> {
	await vscode.commands.executeCommand(`${ExtensionRegistryInfo.views.Sidebar}.focus`)
	return {}
}
