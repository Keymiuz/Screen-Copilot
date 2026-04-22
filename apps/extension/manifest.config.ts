import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'MindSide Meeting MVP',
  version: '0.1.0',
  description: 'AI meeting copilot in a Chrome side panel.',
  permissions: ['activeTab', 'storage', 'tabs', 'tabCapture', 'sidePanel', 'offscreen'],
  host_permissions: [
    'https://meet.google.com/*',
    'https://teams.microsoft.com/*',
    'https://*.zoom.us/wc/*',
    'https://generativelanguage.googleapis.com/*'
  ],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module'
  },
  side_panel: {
    default_path: 'src/sidebar/sidebar.html'
  },
  action: {
    default_title: 'Open MindSide',
    default_icon: {
      '16': 'public/icons/icon16.png',
      '32': 'public/icons/icon32.png',
      '48': 'public/icons/icon48.png',
      '128': 'public/icons/icon128.png'
    }
  },
  commands: {
    _execute_action: {
      suggested_key: {
        default: 'Alt+M'
      },
      description: 'Open MindSide'
    }
  },
  icons: {
    '16': 'public/icons/icon16.png',
    '32': 'public/icons/icon32.png',
    '48': 'public/icons/icon48.png',
    '128': 'public/icons/icon128.png'
  }
})
