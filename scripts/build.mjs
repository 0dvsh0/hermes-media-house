#!/usr/bin/env node
/**
 * Hermes Media Desk — Frontend Build Script
 * Bundles modular files from client/ into desktop/plugin.js
 * Validates syntax, theme compliance, import restrictions, and English-only strings.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const clientDir = resolve(rootDir, 'client')
const outputFile = resolve(rootDir, 'desktop', 'plugin.js')

const MODULES = [
  'constants.js',
  'ui.js',
  'i18n.js',
  'util.js',
  'layout.js',
  'related.js',
  'camera.js',
  'card.js',
  'stamps.js',
  'canvas.js',
  'content.js',
  'schedule.js',
  'insights.js',
  'studio.js',
  'chat.js',
  'settings.js',
  'style.js',
  'app.js',
]

console.log('[build] Assembling modular client files...')

const HEADER = `/**
 * hermes-media-desk — Desktop Plugin Entry Point, State Management, and Views
 *
 * Built from modular client/ source:
 * - Spatial canvas with spring camera, inertia panning, and draggable cards
 * - Bento Studio overlay (hero, cover collage, script editor, 6-frame storyboard)
 * - Assistant ChatDock, Content Kanban/Table, Schedule calendar, Insights analytics, Styles
 *
 * Strict Hermes theme tokens compliance. 100% English only.
 */

import { ROUTES_AREA, SIDEBAR_NAV_AREA } from '@hermes/plugin-sdk'
import { jsx, jsxs } from 'react/jsx-runtime'
import React, {
  useState,
  useReducer,
  useEffect,
  useContext,
  createContext,
  useCallback,
  useRef,
  useMemo,
  useLayoutEffect,
} from 'react'
`

const chunks = [HEADER]

for (const mod of MODULES) {
  const filePath = resolve(clientDir, mod)
  let code = readFileSync(filePath, 'utf-8')

  // Remove all import statements (single-line and multi-line) from client modules
  code = code.replace(/import\s+(?:\{[\s\S]*?\}|[\w*]+(?:\s*,\s*\{[\s\S]*?\})?)\s+from\s+['"][^'"]+['"];?/g, '')
  // Also clean up any lingering import lines
  code = code
    .split('\n')
    .filter(line => !line.trim().startsWith('import ') && !line.includes(' from \'./') && !line.includes(' from "./'))
    .join('\n')

  chunks.push(`\n// ---------------------------------------------------------------------------\n// Module: client/${mod}\n// ---------------------------------------------------------------------------\n` + code)
}

const finalJs = chunks.join('\n')

// 1. Check Chinese characters
const chineseMatches = finalJs.match(/[\u4e00-\u9fff]/g)
if (chineseMatches && chineseMatches.length > 0) {
  console.error(`[build] ERROR: Found ${chineseMatches.length} Chinese characters in output!`)
  process.exit(1)
}

// 2. Check hardcoded hex colors
const codeWithoutComments = finalJs.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')
const hexMatches = codeWithoutComments.match(/#[0-9a-fA-F]{3,8}\b/g)
if (hexMatches && hexMatches.length > 0) {
  console.error('[build] ERROR: Found hardcoded hex colors:', hexMatches)
  process.exit(1)
}

// 3. Check rgb/rgba/hsl/hsla
const rgbMatches = codeWithoutComments.match(/\b(rgba?|hsla?)\s*\(.*?\)/g)
if (rgbMatches && rgbMatches.length > 0) {
  console.error('[build] ERROR: Found hardcoded rgb/hsl colors:', rgbMatches)
  process.exit(1)
}

// 4. Check forbidden JSX syntax
const jsxMatches = codeWithoutComments.match(/<\/\s*[a-zA-Z][a-zA-Z0-9]*\s*>|<\s*[A-Z][a-zA-Z0-9]*\s*[\s/>]/g)
if (jsxMatches && jsxMatches.length > 0) {
  console.error('[build] ERROR: Found forbidden JSX syntax:', jsxMatches)
  process.exit(1)
}

writeFileSync(outputFile, finalJs, 'utf-8')
console.log(`[build] Wrote ${outputFile} (${(finalJs.length / 1024).toFixed(1)} KB)`)

// 5. Verify syntax with node -c
try {
  execFileSync('node', ['-c', outputFile], { stdio: 'inherit' })
  console.log('[build] Node syntax check passed: node -c desktop/plugin.js (exit 0)')
} catch (err) {
  console.error('[build] Node syntax check failed!')
  process.exit(1)
}
