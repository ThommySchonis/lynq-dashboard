// Static content for the MCP settings page (Figma 1437-312 / 1435-72323 / 1435-72810).
// No MCP backend yet — the endpoint is a static URL and all copy lives here.

export const MCP_ENDPOINT = 'https://app.lynq.app/api/v1/mcp'

// TODO: replace with the real prompt-guide URL once it exists.
export const MCP_PROMPT_GUIDE_URL = '#'

// Brand mark SVGs (public/icons). Used by both the tabs and the prompt pills.
export const CLAUDE_ICON = '/icons/claude.svg'
export const CHATGPT_ICON = '/icons/chatgpt.svg'

// ── Assistants (brand identity: icon + label + deep-link) ────────────────────
// Single source of truth for Claude / ChatGPT, used by the prompt pills.

export interface Assistant {
  id: string
  label: string
  iconSrc: string
  chatUrl: (prompt: string) => string
}

export const ASSISTANTS: Assistant[] = [
  {
    id: 'claude',
    label: 'Claude',
    iconSrc: CLAUDE_ICON,
    chatUrl: (prompt) => `https://claude.ai/new?q=${encodeURIComponent(prompt)}`,
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    iconSrc: CHATGPT_ICON,
    chatUrl: (prompt) => `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`,
  },
]

// ── Connection steps (tabbed by client) ──────────────────────────────────────

export type StepStyle = 'accent' | 'bold' | 'code'
export interface StepSegment {
  text: string
  style?: StepStyle
}
export interface ConnectionTab {
  id: string
  label: string
  iconSrc: string
  steps: StepSegment[][]
}

export const CONNECTION_TABS: ConnectionTab[] = [
  {
    id: 'claude-web',
    label: 'Claude web',
    iconSrc: CLAUDE_ICON,
    steps: [
      [{ text: 'Open Claude, then head to ' }, { text: 'Settings → Connectors', style: 'accent' }],
      [{ text: 'Pick ' }, { text: 'Add a custom connector', style: 'bold' }],
      [{ text: 'Call it ' }, { text: '“Lynq & Flow”', style: 'bold' }, { text: ' and drop in the URL above' }],
      [{ text: 'Authorise when asked' }],
    ],
  },
  {
    id: 'claude-code',
    label: 'Claude Code',
    iconSrc: CLAUDE_ICON,
    steps: [
      [{ text: 'Type ' }, { text: '/mcp', style: 'code' }, { text: ' to open connector setup' }],
      [{ text: 'Register a new server named ' }, { text: '“Lynq & Flow”', style: 'bold' }, { text: ' with the URL above' }],
      [{ text: 'Finish signing in to your workspace when prompted' }],
    ],
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    iconSrc: CHATGPT_ICON,
    steps: [
      [{ text: 'In ChatGPT, open ' }, { text: 'Settings → Connectors', style: 'accent' }],
      [{ text: 'Add a custom connector and paste the URL above' }],
      [{ text: 'Name it ' }, { text: '“Lynq & Flow”', style: 'bold' }, { text: ', then sign in to your workspace' }],
    ],
  },
]

// ── What it unlocks ──────────────────────────────────────────────────────────

export const WHAT_IT_UNLOCKS = [
  'Look up and narrow tickets by date, status or tag',
  'Close, snooze or hand off tickets',
  'Turn real customer questions into help articles',
  'Adjust Emma’s instructions and trial the results',
  'Surface trends across hundreds of tickets',
]

// ── Starter prompts ──────────────────────────────────────────────────────────

export interface StarterPrompt {
  title: string
  body: string
}

export const STARTER_PROMPTS: StarterPrompt[] = [
  {
    title: 'Spot what Emma could automate',
    body: 'Scan our most recent 200 tickets for repeat questions Emma isn’t handling yet, and propose guidance rules to take them over.',
  },
  {
    title: 'Draft help articles from tickets',
    body: 'Comb through recent tickets for topics we should document. Ask me whatever you need, then write the articles for me to check.',
  },
  {
    title: 'Check Emma’s knowledge for clashes',
    body: 'Cross-check Emma’s guidance rules, saved replies and help articles, and flag anywhere two sources give a different answer.',
  },
  {
    title: 'Break down refund drivers',
    body: 'Go through refund-tagged tickets from the past month — which reasons and products come up most? Recommend fixes.',
  },
]

