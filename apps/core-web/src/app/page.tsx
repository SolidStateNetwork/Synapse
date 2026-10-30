"use client";

import React from "react";
import InteractiveControlCenterCanvas from "@/components/InteractiveControlCenterCanvas";
import FirewallView from "@/components/views/FirewallView";
import AccessRulesView from "@/components/views/AccessRulesView";
import AuditLogView from "@/components/views/AuditLogView";
import ReverseProxyView from "@/components/views/ReverseProxyView";
import PeersView from "@/components/views/PeersView";
import SettingsView from "@/components/views/SettingsView";
import CopilotDrawer from "@/components/drawers/CopilotDrawer";
import BottomPtyDrawer from "@/components/drawers/BottomPtyDrawer";
import {
  BrainVaultView,
  WorkspaceExplorerView,
} from "@/components/views/BrainVaultAndWorkspaceViews";
import ControlCenterModals from "@/components/modals/ControlCenterModals";
import CommandPaletteModal from "@/components/modals/CommandPaletteModal";
import {
  ControlCenterHeader,
  ControlCenterSidebar,
  UnhealthyServiceBanner,
} from "@/components/layout/ControlCenterChrome";
import { useControlCenterController } from "@/hooks/useControlCenterController";

export default function SynapseNetBirdControlCenter() {
  const c = useControlCenterController();

  return (
    <div className="dark flex h-screen w-screen overflow-hidden bg-nb-gray-950 text-nb-gray-100">
      <ControlCenterSidebar
        sidebarCollapsed={c.sidebarCollapsed}
        setSidebarCollapsed={c.setSidebarCollapsed}
        activeNav={c.activeNav}
        setActiveNav={c.setActiveNav}
        projects={c.projects}
        activeProject={c.activeProject}
        loadWorkspace={c.loadWorkspace}
        setNewProjectModal={c.setNewProjectModal}
        sidebarItems={c.sidebarItems}
        gatewayNodes={c.gatewayNodes}
        systemUpdateStatus={c.systemUpdateStatus}
        systemUpdateBusy={c.systemUpdateBusy}
        onOpenSystemUpdateTab={() => {
          c.setSettingsTab("system-update");
          c.setActiveNav("settings");
          c.fetchSystemUpdateStatus(true, true);
        }}
        onRunSystemUpdate={c.handleRunSystemUpdate}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <ControlCenterHeader
          activeProject={c.activeProject}
          activeNavLabel={
            c.sidebarItems.find((i) => i.id === c.activeNav)?.label
          }
          primaryNode={c.primaryNode}
          primaryNodeOnline={Boolean(
            c.gatewayNodes.find(
              (n) => n.node_id === c.primaryNode && n.online
            )
          )}
          statusToast={c.statusToast}
          copilotDrawerOpen={c.copilotDrawerOpen}
          setCopilotDrawerOpen={c.setCopilotDrawerOpen}
          onOpenPeers={() => c.setActiveNav("peers")}
          onOpenCommandPalette={() => c.setCommandPaletteOpen(true)}
          onOpenAddPeerModal={() => {
            c.setAddPeerModalOpen(true);
            if (!c.issuedToken) c.handleGenerateJoinToken();
          }}
        />

        <UnhealthyServiceBanner
          unhealthyServices={c.unhealthyServices}
          onDiagnoseService={(port) =>
            c.handleQuickAction(`diagnose and auto-heal service ${port}`)
          }
          onRemoveService={c.handleRemoveService}
        />

        <div className="flex flex-1 overflow-hidden">
          <main className="relative flex-1 overflow-y-auto">
            {c.activeNav === "control-center" && (
              <InteractiveControlCenterCanvas
                gatewayNodes={c.gatewayNodes}
                primaryNode={c.primaryNode}
                cartridges={c.cartridges}
                activeCartridges={c.activeProject?.active_cartridges || []}
                joinTier={
                  c.activeProject?.assigned_nodes?.[0]?.tier || c.joinTier
                }
                modelName={c.modelName}
                baseUrl={c.baseUrl}
                secretKeysCount={c.secretKeys.length}
                registeredServices={c.activeProject?.registered_services || []}
                flowView={c.flowView}
                onSelectNode={(nodeId) => c.setSelectedNodeId(nodeId)}
                onToggleCartridge={(id) => c.handleToggleCartridge(id)}
                onOpenAddPeer={() => {
                  c.setAddPeerModalOpen(true);
                  if (!c.issuedToken) c.handleGenerateJoinToken();
                }}
                onOpenPty={() => c.setTerminalDrawerOpen(true)}
                onOpenAiSettings={() => c.setAiEndpointModalOpen(true)}
                onOpenBrainDoc={(doc) => {
                  c.setBrainDocTab(doc);
                  c.setActiveNav("brain-vault");
                }}
                onOpenSecretsVault={() => {
                  c.setSettingsTab("secrets-vault");
                  c.setActiveNav("settings");
                }}
                onOpenReverseProxy={(port) => {
                  if (port) c.setPreviewPort(port);
                  c.setActiveNav("reverse-proxy");
                }}
                onOpenAccessControl={() => c.setActiveNav("access-control")}
                onOpenRemoteFiles={() => c.setActiveNav("workspace")}
                onDeployDemoService={() =>
                  c.handleQuickAction("deploy microservice 4050")
                }
                onHealService={(port) =>
                  c.handleQuickAction(`heal service ${port}`)
                }
                firewallPolicies={c.activeProject?.firewall_policies}
                onOpenFirewall={(nodeId) => {
                  if (nodeId) c.setSelectedNodeId(nodeId);
                  c.setActiveNav("firewall");
                }}
                onOpenSettings={(tab) => {
                  c.setSettingsTab(
                    (tab as
                      | "system-update"
                      | "watchdog-rbac"
                      | "setup-keys"
                      | "secrets-vault"
                      | "ai-providers"
                      | "mcp-server"
                      | "debug-console"
                      | "language") || "watchdog-rbac"
                  );
                  c.setActiveNav("settings");
                }}
              />
            )}

            {c.activeNav === "peers" && (
              <PeersView
                activeProject={c.activeProject}
                gatewayNodes={c.gatewayNodes}
                filteredPeers={c.filteredPeers}
                blueprints={c.blueprints}
                peersSubTab={c.peersSubTab}
                setPeersSubTab={c.setPeersSubTab}
                peerSearch={c.peerSearch}
                setPeerSearch={c.setPeerSearch}
                peerTierFilter={c.peerTierFilter}
                setPeerTierFilter={c.setPeerTierFilter}
                expandedPeerRows={c.expandedPeerRows}
                setExpandedPeerRows={c.setExpandedPeerRows}
                systemUpdateBusy={c.systemUpdateBusy}
                onRunSystemUpdate={(action, targetNodeId) => {
                  c.handleRunSystemUpdate(action, targetNodeId);
                }}
                onOpenAddPeerModal={() => {
                  c.setAddPeerModalOpen(true);
                  if (!c.issuedToken) c.handleGenerateJoinToken();
                }}
                onSelectNodeAndNavigate={(nodeId, nav) => {
                  c.setSelectedNodeId(nodeId);
                  c.setActiveNav(nav);
                }}
                onOpenTerminalForNode={(nodeId) => {
                  c.setSelectedNodeId(nodeId);
                  c.setTerminalDrawerOpen(true);
                }}
                onAssignNode={c.handleAssignNode}
                onUnassignNode={c.handleUnassignNode}
                onOpenServiceInProxy={(serviceId, port) => {
                  c.setSelectedServiceId(serviceId);
                  c.setPreviewPort(port);
                  c.setActiveNav("reverse-proxy");
                }}
                meshSourceNode={c.meshSourceNode}
                setMeshSourceNode={c.setMeshSourceNode}
                meshTargetNode={c.meshTargetNode}
                setMeshTargetNode={c.setMeshTargetNode}
                meshTargetPort={c.meshTargetPort}
                setMeshTargetPort={c.setMeshTargetPort}
                meshAliasEnv={c.meshAliasEnv}
                setMeshAliasEnv={c.setMeshAliasEnv}
                onAddMeshLink={c.handleAddMeshLink}
                onRemoveMeshLink={c.handleRemoveMeshLink}
                onRunPromptInCopilot={(prompt) => {
                  c.setCopilotDrawerOpen(true);
                  c.runStreamingPrompt(prompt);
                }}
                playbookName={c.playbookName}
                setPlaybookName={c.setPlaybookName}
                playbookCron={c.playbookCron}
                setPlaybookCron={c.setPlaybookCron}
                playbookPrompt={c.playbookPrompt}
                setPlaybookPrompt={c.setPlaybookPrompt}
                onAddPlaybook={c.handleAddPlaybook}
                onTogglePlaybook={c.handleTogglePlaybook}
                onDeletePlaybook={c.handleDeletePlaybook}
              />
            )}

            {c.activeNav === "firewall" && (
              <FirewallView
                activeProject={c.activeProject}
                gatewayNodes={c.gatewayNodes}
                selectedNodeId={c.selectedNodeId}
                setSelectedNodeId={c.setSelectedNodeId}
                liveFirewallPorts={c.liveFirewallPorts}
                firewallBusy={c.firewallBusy}
                firewallError={c.firewallError}
                setFirewallError={c.setFirewallError}
                fetchFirewallStatus={c.fetchFirewallStatus}
                handleFirewallAction={c.handleFirewallAction}
                fwRuleAction={c.fwRuleAction}
                setFwRuleAction={c.setFwRuleAction}
                fwIpInput={c.fwIpInput}
                setFwIpInput={c.setFwIpInput}
                fwRulePort={c.fwRulePort}
                setFwRulePort={c.setFwRulePort}
                fwRuleNote={c.fwRuleNote}
                setFwRuleNote={c.setFwRuleNote}
                handleAddFirewallIpRule={c.handleAddFirewallIpRule}
                onAskCopilot={(prompt) => {
                  c.setCopilotDrawerOpen(true);
                  c.runStreamingPrompt(prompt);
                }}
              />
            )}

            {c.activeNav === "access-control" && (
              <AccessRulesView
                activeProject={c.activeProject}
                cartridges={c.cartridges}
                pendingApprovals={c.pendingApprovals}
                selectedCartridgeId={c.selectedCartridgeId}
                setSelectedCartridgeId={c.setSelectedCartridgeId}
                showCustomCartModal={c.showCustomCartModal}
                setShowCustomCartModal={c.setShowCustomCartModal}
                customCartName={c.customCartName}
                setCustomCartName={c.setCustomCartName}
                customCartCategory={c.customCartCategory}
                setCustomCartCategory={c.setCustomCartCategory}
                customCartDesc={c.customCartDesc}
                setCustomCartDesc={c.setCustomCartDesc}
                customCartContent={c.customCartContent}
                setCustomCartContent={c.setCustomCartContent}
                handleCreateCustomCartridge={c.handleCreateCustomCartridge}
                handleToggleCartridge={c.handleToggleCartridge}
                handleResolveApproval={c.handleResolveApproval}
              />
            )}

            {c.activeNav === "reverse-proxy" && (
              <ReverseProxyView
                activeProject={c.activeProject}
                primaryNode={c.primaryNode}
                gatewayUrl={c.gatewayUrl}
                selectedServiceId={c.selectedServiceId}
                setSelectedServiceId={c.setSelectedServiceId}
                previewPort={c.previewPort}
                setPreviewPort={c.setPreviewPort}
                previewSubPath={c.previewSubPath}
                setPreviewSubPath={c.setPreviewSubPath}
                previewReloadNonce={c.previewReloadNonce}
                setPreviewReloadNonce={c.setPreviewReloadNonce}
                serviceWorkspaceTab={c.serviceWorkspaceTab}
                setServiceWorkspaceTab={c.setServiceWorkspaceTab}
                selectedEndpointId={c.selectedEndpointId}
                setSelectedEndpointId={c.setSelectedEndpointId}
                serviceActionMethod={c.serviceActionMethod}
                setServiceActionMethod={c.setServiceActionMethod}
                serviceActionPath={c.serviceActionPath}
                setServiceActionPath={c.setServiceActionPath}
                serviceActionPayload={c.serviceActionPayload}
                setServiceActionPayload={c.setServiceActionPayload}
                serviceActionBusy={c.serviceActionBusy}
                serviceActionResult={c.serviceActionResult}
                handleInvokeServiceAction={c.handleInvokeServiceAction}
              />
            )}

            {c.activeNav === "brain-vault" && (
              <BrainVaultView
                projectId={c.activeProject?.project_id || "synapse-cloud-demo"}
                brainDocTab={c.brainDocTab}
                setBrainDocTab={c.setBrainDocTab}
                isEditingMarkdown={c.isEditingMarkdown}
                setIsEditingMarkdown={c.setIsEditingMarkdown}
                architectureMd={c.architectureMd}
                setArchitectureMd={c.setArchitectureMd}
                memoryMd={c.memoryMd}
                setMemoryMd={c.setMemoryMd}
                handleSaveBrainDoc={c.handleSaveBrainDoc}
              />
            )}

            {c.activeNav === "workspace" && (
              <WorkspaceExplorerView
                showDiffDrawer={c.showDiffDrawer}
                setShowDiffDrawer={c.setShowDiffDrawer}
                handleSaveRemoteFile={c.handleSaveRemoteFile}
                workspaceSidebarWidth={c.workspaceSidebarWidth}
                setWorkspaceSidebarWidth={c.setWorkspaceSidebarWidth}
                remoteDir={c.remoteDir}
                fetchRemoteDir={c.fetchRemoteDir}
                remoteEntries={c.remoteEntries}
                activeFilePath={c.activeFilePath}
                openRemoteFile={c.openRemoteFile}
                handleDeleteRemoteFile={c.handleDeleteRemoteFile}
                handleCreateRemoteFile={c.handleCreateRemoteFile}
                newFileName={c.newFileName}
                setNewFileName={c.setNewFileName}
                diffPatchText={c.diffPatchText}
                setDiffPatchText={c.setDiffPatchText}
                handleApplyUnifiedDiff={c.handleApplyUnifiedDiff}
                editorContent={c.editorContent}
                setEditorContent={c.setEditorContent}
              />
            )}

            {c.activeNav === "activity" && (
              <AuditLogView
                filteredLogs={c.filteredLogs}
                totalLogsCount={c.auditLogs.length}
                activitySearch={c.activitySearch}
                setActivitySearch={c.setActivitySearch}
                activityStatusFilter={c.activityStatusFilter}
                setActivityStatusFilter={c.setActivityStatusFilter}
                expandedAuditRows={c.expandedAuditRows}
                setExpandedAuditRows={c.setExpandedAuditRows}
              />
            )}

            {c.activeNav === "settings" && (
              <SettingsView
                activeProject={c.activeProject}
                primaryNode={c.primaryNode}
                settingsTab={c.settingsTab}
                setSettingsTab={c.setSettingsTab}
                secretKeys={c.secretKeys}
                debugModeEnabled={c.debugModeEnabled}
                fetchDebugSnapshot={c.fetchDebugSnapshot}
                fetchSystemUpdateStatus={c.fetchSystemUpdateStatus}
                systemUpdateBusy={c.systemUpdateBusy}
                systemUpdateActionLabel={c.systemUpdateActionLabel}
                systemUpdateStatus={c.systemUpdateStatus}
                systemUpdateSteps={c.systemUpdateSteps}
                setSystemUpdateSteps={c.setSystemUpdateSteps}
                showReleaseNotes={c.showReleaseNotes}
                setShowReleaseNotes={c.setShowReleaseNotes}
                handleRunSystemUpdate={c.handleRunSystemUpdate}
                gatewayUrl={c.gatewayUrl}
                setGatewayUrl={c.setGatewayUrl}
                joinNodeName={c.joinNodeName}
                setJoinNodeName={c.setJoinNodeName}
                joinTier={c.joinTier}
                setJoinTier={c.setJoinTier}
                handleGenerateJoinToken={c.handleGenerateJoinToken}
                issuedToken={c.issuedToken}
                oneLineInstallerCmd={c.oneLineInstallerCmd}
                copiedJoinCmd={c.copiedJoinCmd}
                setCopiedJoinCmd={c.setCopiedJoinCmd}
                rebindCliCmd={c.rebindCliCmd}
                copiedRebindCmd={c.copiedRebindCmd}
                setCopiedRebindCmd={c.setCopiedRebindCmd}
                newSecretKey={c.newSecretKey}
                setNewSecretKey={c.setNewSecretKey}
                newSecretVal={c.newSecretVal}
                setNewSecretVal={c.setNewSecretVal}
                handleAddSecret={c.handleAddSecret}
                handleDeleteSecret={c.handleDeleteSecret}
                provider={c.provider}
                setProvider={c.setProvider}
                baseUrl={c.baseUrl}
                setBaseUrl={c.setBaseUrl}
                modelName={c.modelName}
                setModelName={c.setModelName}
                handleSyncModels={c.handleSyncModels}
                syncingModels={c.syncingModels}
                modelSyncStatus={c.modelSyncStatus}
                discoveredModels={c.discoveredModels}
                apiKeySecretName={c.apiKeySecretName}
                apiKeyInput={c.apiKeyInput}
                setApiKeyInput={c.setApiKeyInput}
                enablePromptCaching={c.enablePromptCaching}
                setEnablePromptCaching={c.setEnablePromptCaching}
                enableAutoWatchdog={c.enableAutoWatchdog}
                setEnableAutoWatchdog={c.setEnableAutoWatchdog}
                handleSaveAiEndpoint={c.handleSaveAiEndpoint}
                mcpKeyName={c.mcpKeyName}
                setMcpKeyName={c.setMcpKeyName}
                mcpKeyScopeMode={c.mcpKeyScopeMode}
                setMcpKeyScopeMode={c.setMcpKeyScopeMode}
                handleCreateMcpKey={c.handleCreateMcpKey}
                issuedMcpToken={c.issuedMcpToken}
                copiedMcpToken={c.copiedMcpToken}
                setCopiedMcpToken={c.setCopiedMcpToken}
                showMcpConfigExamples={c.showMcpConfigExamples}
                setShowMcpConfigExamples={c.setShowMcpConfigExamples}
                copiedMcpConfig={c.copiedMcpConfig}
                setCopiedMcpConfig={c.setCopiedMcpConfig}
                handleRevokeMcpKey={c.handleRevokeMcpKey}
                handleTestMcpEndpoint={c.handleTestMcpEndpoint}
                mcpTestOutput={c.mcpTestOutput}
                handleToggleDebugMode={c.handleToggleDebugMode}
                handleRunSelfTest={c.handleRunSelfTest}
                runningSelfTest={c.runningSelfTest}
                selfTestChecks={c.selfTestChecks}
                debugSnapshot={c.debugSnapshot}
                settingsAlertConfig={c.settingsAlertConfig}
                setSettingsAlertConfig={c.setSettingsAlertConfig}
                settingsAlertNotice={c.settingsAlertNotice}
                setSettingsAlertNotice={c.setSettingsAlertNotice}
                settingsAuthEnabled={c.settingsAuthEnabled}
                setSettingsAuthEnabled={c.setSettingsAuthEnabled}
                settingsAdminPwd={c.settingsAdminPwd}
                setSettingsAdminPwd={c.setSettingsAdminPwd}
                settingsOperatorPwd={c.settingsOperatorPwd}
                setSettingsOperatorPwd={c.setSettingsOperatorPwd}
                settingsTotpPin={c.settingsTotpPin}
                setSettingsTotpPin={c.setSettingsTotpPin}
                settingsAuthNotice={c.settingsAuthNotice}
                setSettingsAuthNotice={c.setSettingsAuthNotice}
              />
            )}
          </main>

          {c.copilotDrawerOpen && (
            <CopilotDrawer
              locale={c.locale}
              activeProject={c.activeProject}
              primaryNode={c.primaryNode}
              copilotWide={c.copilotWide}
              setCopilotWide={c.setCopilotWide}
              copilotWidth={c.copilotWidth}
              setCopilotWidth={c.setCopilotWidth}
              setCopilotDrawerOpen={c.setCopilotDrawerOpen}
              isDraggingOverChat={c.isDraggingOverChat}
              setIsDraggingOverChat={c.setIsDraggingOverChat}
              processDroppedOrSelectedFiles={c.processDroppedOrSelectedFiles}
              enablePromptCaching={c.enablePromptCaching}
              setEnablePromptCaching={c.setEnablePromptCaching}
              latestCacheMetrics={c.latestCacheMetrics}
              handleClearChat={c.handleClearChat}
              chatHistory={c.chatHistory}
              chatMessageFilter={c.chatMessageFilter}
              setChatMessageFilter={c.setChatMessageFilter}
              chatScrollRef={c.chatScrollRef}
              chatInputRef={c.chatInputRef}
              chatComposerRef={c.chatComposerRef}
              fileInputRef={c.fileInputRef}
              expandedThinking={c.expandedThinking}
              setExpandedThinking={c.setExpandedThinking}
              expandedRawPrompts={c.expandedRawPrompts}
              setExpandedRawPrompts={c.setExpandedRawPrompts}
              copiedChatMsgIdx={c.copiedChatMsgIdx}
              setCopiedChatMsgIdx={c.setCopiedChatMsgIdx}
              expandedTurnTools={c.expandedTurnTools}
              setExpandedTurnTools={c.setExpandedTurnTools}
              turnToolCategoryFilter={c.turnToolCategoryFilter}
              setTurnToolCategoryFilter={c.setTurnToolCategoryFilter}
              expandedTools={c.expandedTools}
              setExpandedTools={c.setExpandedTools}
              setPreviewPort={c.setPreviewPort}
              setActiveNav={c.setActiveNav}
              openRemoteFile={c.openRemoteFile}
              setBrainDocTab={c.setBrainDocTab}
              setTerminalDrawerOpen={c.setTerminalDrawerOpen}
              setStatusToast={c.setStatusToast}
              setSelectedChatSkill={c.setSelectedChatSkill}
              selectedChatSkill={c.selectedChatSkill}
              chatBusy={c.chatBusy}
              chatElapsedSec={c.chatElapsedSec}
              liveSteps={c.liveSteps}
              streamingThinkingText={c.streamingThinkingText}
              streamingReplyText={c.streamingReplyText}
              handleUpdateSkillDecision={c.handleUpdateSkillDecision}
              handleStartSkillInterview={c.handleStartSkillInterview}
              handleInterviewStepResponse={c.handleInterviewStepResponse}
              setSelectedServiceId={c.setSelectedServiceId}
              setServiceActionMethod={c.setServiceActionMethod}
              setServiceActionPath={c.setServiceActionPath}
              setServiceActionPayload={c.setServiceActionPayload}
              handleInvokeServiceAction={c.handleInvokeServiceAction}
              handleRollbackSnapshot={c.handleRollbackSnapshot}
              handleSendPrompt={c.handleSendPrompt}
              skillMenuOpen={c.skillMenuOpen}
              setSkillMenuOpen={c.setSkillMenuOpen}
              mentionMenuOpen={c.mentionMenuOpen}
              setMentionMenuOpen={c.setMentionMenuOpen}
              setMentionFilter={c.setMentionFilter}
              mentionCandidates={c.mentionCandidates}
              insertMentionToken={c.insertMentionToken}
              chatAttachments={c.chatAttachments}
              setChatAttachments={c.setChatAttachments}
              chatInput={c.chatInput}
              setChatInput={c.setChatInput}
              handleChatInputChange={c.handleChatInputChange}
              handleChatPaste={c.handleChatPaste}
            />
          )}
        </div>

        <BottomPtyDrawer
          terminalDrawerOpen={c.terminalDrawerOpen}
          setTerminalDrawerOpen={c.setTerminalDrawerOpen}
          terminalHeight={c.terminalHeight}
          setTerminalHeight={c.setTerminalHeight}
          primaryNode={c.primaryNode}
          activeHeartbeat={c.activeHeartbeat}
          gatewayUrl={c.gatewayUrl}
          activeProject={c.activeProject}
        />
      </div>

      <ControlCenterModals
        addPeerModalOpen={c.addPeerModalOpen}
        setAddPeerModalOpen={c.setAddPeerModalOpen}
        gatewayUrl={c.gatewayUrl}
        setGatewayUrl={c.setGatewayUrl}
        joinTier={c.joinTier}
        setJoinTier={c.setJoinTier}
        joinNodeName={c.joinNodeName}
        setJoinNodeName={c.setJoinNodeName}
        handleGenerateJoinToken={c.handleGenerateJoinToken}
        oneLineInstallerCmd={c.oneLineInstallerCmd}
        copiedJoinCmd={c.copiedJoinCmd}
        setCopiedJoinCmd={c.setCopiedJoinCmd}
        rebindCliCmd={c.rebindCliCmd}
        copiedRebindCmd={c.copiedRebindCmd}
        setCopiedRebindCmd={c.setCopiedRebindCmd}
        aiEndpointModalOpen={c.aiEndpointModalOpen}
        setAiEndpointModalOpen={c.setAiEndpointModalOpen}
        handleSaveAiEndpoint={c.handleSaveAiEndpoint}
        provider={c.provider}
        setProvider={c.setProvider}
        baseUrl={c.baseUrl}
        setBaseUrl={c.setBaseUrl}
        modelName={c.modelName}
        setModelName={c.setModelName}
        handleSyncModels={c.handleSyncModels}
        syncingModels={c.syncingModels}
        modelSyncStatus={c.modelSyncStatus}
        discoveredModels={c.discoveredModels}
        apiKeySecretName={c.apiKeySecretName}
        apiKeyInput={c.apiKeyInput}
        setApiKeyInput={c.setApiKeyInput}
        secretKeys={c.secretKeys}
        enablePromptCaching={c.enablePromptCaching}
        setEnablePromptCaching={c.setEnablePromptCaching}
        enableAutoWatchdog={c.enableAutoWatchdog}
        setEnableAutoWatchdog={c.setEnableAutoWatchdog}
        newProjectModal={c.newProjectModal}
        setNewProjectModal={c.setNewProjectModal}
        newProjName={c.newProjName}
        setNewProjName={c.setNewProjName}
        loadWorkspace={c.loadWorkspace}
        commandPaletteOpen={false}
        setCommandPaletteOpen={c.setCommandPaletteOpen}
        commandQuery={c.commandQuery}
        setCommandQuery={c.setCommandQuery}
        sidebarItems={c.sidebarItems}
        setActiveNav={c.setActiveNav}
      />

      <CommandPaletteModal
        open={c.commandPaletteOpen}
        onClose={() => c.setCommandPaletteOpen(false)}
        activeProject={c.activeProject}
        gatewayNodes={c.gatewayNodes}
        onNavigate={(nav) => c.setActiveNav(nav)}
        onOpenSettingsTab={(tab) => {
          c.setSettingsTab(tab);
          c.setActiveNav("settings");
        }}
        onOpenBrainDoc={(doc) => {
          c.setBrainDocTab(doc);
          c.setActiveNav("brain-vault");
        }}
        onOpenServiceProxy={(port, serviceId) => {
          if (serviceId) c.setSelectedServiceId(serviceId);
          c.setPreviewPort(port);
          c.setActiveNav("reverse-proxy");
        }}
        onOpenNodeTerminal={(nodeId) => {
          c.setSelectedNodeId(nodeId);
          c.setTerminalDrawerOpen(true);
        }}
        onOpenNodeFirewall={(nodeId) => {
          c.setSelectedNodeId(nodeId);
          c.setActiveNav("firewall");
        }}
        onRunCopilotSkill={(prompt) => {
          c.setCopilotDrawerOpen(true);
          c.runStreamingPrompt(prompt);
        }}
        onShowToast={(msg) => c.setStatusToast(msg)}
        sidebarItems={c.sidebarItems}
        setActiveNav={c.setActiveNav}
      />
    </div>
  );
}
