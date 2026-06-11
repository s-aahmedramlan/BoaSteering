import { useState } from 'react'
import {
  Github, Bug, MessageSquare, FileText,
  CheckCircle, Clock, RefreshCw,
  Plug, Unplug, ChevronDown, ChevronUp,
  Shield, Users, Bell, Palette
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'

interface IntegrationConfigProps {
  name: string
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>
  connected: boolean
  status: 'synced' | 'pending' | 'error'
  lastSync: string
  description: string
  config: { label: string; value: string }[]
}

function IntegrationConfig({ name, icon: Icon, connected, status, lastSync, description, config }: IntegrationConfigProps) {
  const [expanded, setExpanded] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  const handleConnect = () => {
    setIsConnecting(true)
    setTimeout(() => setIsConnecting(false), 1500)
  }

  return (
    <div className="border-b border-[var(--border-subtle)] last:border-0">
      <div className="py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 border border-[var(--border-default)] flex items-center justify-center bg-[var(--surface-elevated)] shrink-0">
              <Icon size={20} strokeWidth={1.75} className="text-secondary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-medium text-sm text-primary">{name}</h3>
                <span className={`badge-subtle ${connected ? (status === 'synced' ? 'text-boa' : 'text-warning') : ''}`}>
                  {connected ? (
                    <><CheckCircle size={10} /> Connected</>
                  ) : (
                    <><Unplug size={10} /> Disconnected</>
                  )}
                </span>
              </div>
              <p className="text-sm text-muted mt-1">{description}</p>
              {connected && (
                <div className="flex items-center gap-3 mt-2 text-[12px] text-muted">
                  <span className="flex items-center gap-1"><Clock size={10} /> {lastSync}</span>
                  <span className="flex items-center gap-1"><RefreshCw size={10} /> Auto-sync</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {connected ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs text-muted hover:text-alert px-2"
                  onClick={handleConnect}
                >
                  Disconnect
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-muted"
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                className="h-8 bg-boa hover:bg-boa-bright text-void text-xs px-3"
                onClick={handleConnect}
                disabled={isConnecting}
              >
                {isConnecting ? 'Connecting...' : (
                  <>
                    <Plug size={12} className="mr-1" />
                    Connect
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {expanded && connected && (
        <div className="pb-5 pt-0 border-t border-[var(--border-subtle)]">
          <div className="grid sm:grid-cols-2 gap-3 pt-4">
            {config.map((item, i) => (
              <div key={i} className="flex flex-col gap-0.5 p-3 rounded-md bg-[var(--surface)]">
                <span className="text-[12px] text-muted">{item.label}</span>
                <span className="text-sm text-primary font-mono truncate">{item.value}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted px-2">
              <RefreshCw size={12} className="mr-1" />
              Re-sync
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function SettingRow({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-5 border-b border-[var(--border-subtle)] last:border-0">
      <div className="min-w-0">
        <h3 className="font-medium text-sm text-primary">{label}</h3>
        <p className="text-sm text-muted mt-0.5">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('integrations')

  const tabs = [
    { id: 'integrations', label: 'Integrations', icon: Plug },
    { id: 'workspace', label: 'Workspace', icon: Users },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Palette },
  ]

  const integrations = [
    {
      name: 'GitHub', icon: Github,
      connected: true, status: 'synced' as const, lastSync: '2 minutes ago',
      description: 'Sync repositories, PRs, wikis, and code review discussions.',
      config: [
        { label: 'Repos', value: 'boa-frontend, boa-backend, boa-docs' },
        { label: 'Branches', value: 'main, develop' },
        { label: 'File types', value: '.md, .txt, .rst' },
      ],
    },
    {
      name: 'Jira', icon: Bug,
      connected: true, status: 'synced' as const, lastSync: '15 minutes ago',
      description: 'Sync project issues, epics, decisions, and comments.',
      config: [
        { label: 'Workspace', value: 'acme.atlassian.net' },
        { label: 'Projects', value: 'BOA, ENG, INFRA' },
        { label: 'Types', value: 'Story, Bug, Epic, Decision' },
      ],
    },
    {
      name: 'Slack', icon: MessageSquare,
      connected: true, status: 'synced' as const, lastSync: '5 minutes ago',
      description: 'Sync channel discussions, decisions, and incident threads.',
      config: [
        { label: 'Workspace', value: 'acme.slack.com' },
        { label: 'Channels', value: '#engineering, #deployments' },
        { label: 'Bot', value: '@boa-indexer' },
      ],
    },
    {
      name: 'Confluence', icon: FileText,
      connected: false, status: 'pending' as const, lastSync: '-',
      description: 'Sync documentation pages, meeting notes, and architecture decisions.',
      config: [],
    },
  ]

  return (
    <div className="flex h-[calc(100dvh)] max-w-5xl mx-auto">
      <aside className="w-48 shrink-0 border-r border-[var(--border-default)] p-4">
        <h1 className="font-display font-semibold text-sm text-primary mb-4 px-2">Settings</h1>
        <div className="space-y-0.5">
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 w-full px-2 py-2 rounded-md text-[13px] transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[var(--hover-overlay)] text-primary font-medium'
                    : 'text-secondary hover:text-primary hover:bg-[var(--hover-overlay-sm)]'
                }`}
              >
                <Icon size={15} strokeWidth={1.75} />
                {tab.label}
              </button>
            )
          })}
        </div>
      </aside>

      <div className="flex-1 p-8 overflow-y-auto">
        {activeTab === 'integrations' && (
          <div>
            <div className="mb-6">
              <h2 className="page-title">Integrations</h2>
              <p className="page-subtitle">Connect your tools to build a unified knowledge base.</p>
            </div>
            <div className="panel px-5">
              {integrations.map(integration => (
                <IntegrationConfig key={integration.name} {...integration} />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'workspace' && (
          <div>
            <div className="mb-6">
              <h2 className="page-title">Workspace</h2>
              <p className="page-subtitle">Manage your organization settings.</p>
            </div>
            <div className="panel px-5">
              <SettingRow label="Organization name" description="Shown across the app and in Slack notifications.">
                <span className="text-sm text-primary font-mono">Acme Corp</span>
              </SettingRow>
              <SettingRow label="Auto-sync frequency" description="How often Boa checks connected sources for updates.">
                <span className="text-sm text-boa font-mono">Every 5 minutes</span>
              </SettingRow>
              <SettingRow label="Stale entry threshold" description="Flag entries not updated in this period.">
                <span className="text-sm text-warning font-mono">90 days</span>
              </SettingRow>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div>
            <div className="mb-6">
              <h2 className="page-title">Security</h2>
              <p className="page-subtitle">Authentication and access control.</p>
            </div>
            <div className="panel px-5">
              <SettingRow label="Require rule signing" description="All manually created rules must be cryptographically signed.">
                <Switch defaultChecked />
              </SettingRow>
              <SettingRow label="Source verification" description="Verify the origin of all imported knowledge entries.">
                <Switch defaultChecked />
              </SettingRow>
              <SettingRow label="SSO required" description="Require SSO authentication for all team members.">
                <Switch />
              </SettingRow>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div>
            <div className="mb-6">
              <h2 className="page-title">Notifications</h2>
              <p className="page-subtitle">Configure how and when you get notified.</p>
            </div>
            <div className="panel px-5">
              {[
                { label: 'New rule conflicts', desc: 'When a newly ingested rule conflicts with an existing one' },
                { label: 'Stale entries', desc: 'When entries have not been updated in 90 days' },
                { label: 'Sync failures', desc: 'When an integration fails to sync' },
                { label: 'Weekly digest', desc: 'Summary of new rules and decisions each Monday' },
              ].map(item => (
                <SettingRow key={item.label} label={item.label} description={item.desc}>
                  <Switch defaultChecked={item.label !== 'Weekly digest'} />
                </SettingRow>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'appearance' && (
          <div>
            <div className="mb-6">
              <h2 className="page-title">Appearance</h2>
              <p className="page-subtitle">Customize the look and feel.</p>
            </div>
            <div className="panel px-5">
              <SettingRow label="Theme" description="Dark mode is the default.">
                <span className="text-xs text-muted font-mono">Dark</span>
              </SettingRow>
              <SettingRow label="Code font size" description="Size for agent-readable view and code blocks.">
                <span className="text-xs text-boa font-mono">13px</span>
              </SettingRow>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
