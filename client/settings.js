/**
 * Settings Page Component
 * Provider configuration, image models, and masked API key.
 */

import { jsx, jsxs } from 'react/jsx-runtime'
import React, {
  useState,
  useEffect,
  useContext,
} from 'react'
import { AppContext } from './app.js'
import { INPUT_STYLE, PRIMARY_PILL, GHOST_BTN, SELECT_STYLE, SELECT_OPTION_STYLE } from './constants.js'

// 10b. Settings Page (Requirement 15.3)
// ---------------------------------------------------------------------------

export function SettingsPage({ rest, t }) {
  const [settings, setSettings] = useState(null)
  const [statusMsg, setStatusMsg] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  useEffect(() => {
    rest('/settings')
      .then(data => setSettings(data))
      .catch(err => setStatusMsg((err && err.message) || String(err)))
  }, [rest])

  const handleSave = () => {
    if (!settings) return
    rest('/settings', { method: 'POST', body: JSON.stringify(settings) })
      .then(saved => {
        setSettings(saved)
        setStatusMsg(t('settings.saved'))
        setTimeout(() => setStatusMsg(''), 3000)
      })
      .catch(err => setStatusMsg((err && err.message) || String(err)))
  }

  const handleTest = () => {
    setTesting(true)
    setTestResult(null)
    rest('/settings/test', { method: 'POST', body: JSON.stringify({}) })
      .then(res => {
        setTesting(false)
        setTestResult({ ok: true, src: res && res.src })
      })
      .catch(err => {
        setTesting(false)
        setTestResult({ ok: false, error: (err && err.message) || String(err) })
      })
  }

  if (!settings) {
    return jsx('div', {
      style: { padding: '24px', color: 'var(--ui-text-quaternary)', fontSize: '13px' },
      children: t('loading'),
    })
  }

  const image = settings.image || {}
  const field = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    backgroundColor: 'color-mix(in srgb, var(--color-foreground) 4%, var(--color-background))',
    color: 'var(--color-foreground)',
    fontSize: '13px',
    outline: 'none',
  }
  const labelStyle = {
    display: 'block',
    fontWeight: 600,
    fontSize: '12.5px',
    color: 'var(--color-foreground)',
    marginBottom: '6px',
  }

  return jsxs('div', {
    style: {
      padding: '24px 28px',
      maxWidth: '680px',
      color: 'var(--color-foreground)',
      backgroundColor: 'var(--ui-bg-chrome, var(--color-background))',
    },
    children: [
      jsx('h2', {
        style: { fontSize: '20px', fontWeight: 600, margin: '0 0 20px' },
        children: t('settings.title'),
      }),
      
      jsx('div', { style: { marginBottom: '16px' }, children: [
        jsx('label', { style: labelStyle, children: t('settings.imageSource') }),
        jsx('select', {
          value: image.source || 'http',
          onChange: e =>
            setSettings({ ...settings, image: { ...image, source: e.target.value } }),
          style: { ...SELECT_STYLE, width: '100%' },
          children: [
            jsx('option', { value: 'http', style: SELECT_OPTION_STYLE, children: t('settings.imageSource.http') }),
            jsx('option', { value: 'tool', style: SELECT_OPTION_STYLE, children: t('settings.imageSource.tool') }),
          ],
        }),
      ]}),
      (image.source || 'http') === 'http'
        ? jsxs('div', {
            children: [
              jsx('div', { style: { marginBottom: '16px' }, children: [
                jsx('label', { style: labelStyle, children: t('settings.baseUrl') }),
                jsx('input', {
                  type: 'text',
                  value: image.baseUrl || '',
                  onChange: e =>
                    setSettings({ ...settings, image: { ...image, baseUrl: e.target.value } }),
                  style: field,
                }),
              ]}),
              jsx('div', { style: { marginBottom: '16px' }, children: [
                jsx('label', { style: labelStyle, children: t('settings.apiKey') }),
                jsx('input', {
                  type: 'password',
                  value: image.apiKey || '',
                  onChange: e =>
                    setSettings({ ...settings, image: { ...image, apiKey: e.target.value } }),
                  style: field,
                }),
              ]}),
              jsx('div', { style: { marginBottom: '16px' }, children: [
                jsx('label', { style: labelStyle, children: t('settings.model') }),
                jsx('input', {
                  type: 'text',
                  value: image.model || '',
                  onChange: e =>
                    setSettings({ ...settings, image: { ...image, model: e.target.value } }),
                  style: field,
                }),
              ]}),
            ],
          })
        : null,
      jsx('div', { style: { marginBottom: '16px' }, children: [
        jsx('label', { style: labelStyle, children: t('settings.exportDir') }),
        jsx('input', {
          type: 'text',
          value: settings.exportDir || '',
          onChange: e => setSettings({ ...settings, exportDir: e.target.value }),
          style: field,
        }),
      ]}),
      jsxs('div', {
        style: { display: 'flex', gap: '16px', marginBottom: '16px' },
        children: [
          jsx('div', { style: { flex: 1 }, children: [
            jsx('label', { style: labelStyle, children: t('settings.imageCount') }),
            jsx('input', {
              type: 'number',
              min: 0,
              max: 4,
              value: settings.imageCount != null ? settings.imageCount : 3,
              onChange: e =>
                setSettings({ ...settings, imageCount: parseInt(e.target.value, 10) || 0 }),
              style: field,
            }),
          ]}),
          jsx('div', { style: { flex: 1 }, children: [
            jsx('label', { style: labelStyle, children: t('settings.shotCount') }),
            jsx('input', {
              type: 'number',
              min: 0,
              max: 12,
              value: settings.shotCount != null ? settings.shotCount : 4,
              onChange: e =>
                setSettings({ ...settings, shotCount: parseInt(e.target.value, 10) || 0 }),
              style: field,
            }),
          ]}),
        ],
      }),
      jsx('div', { style: { marginBottom: '16px' }, children: [
        jsx('label', { style: labelStyle, children: t('settings.voiceSample') }),
        jsx('input', {
          type: 'text',
          value: settings.voiceSample || '',
          onChange: e => setSettings({ ...settings, voiceSample: e.target.value }),
          placeholder: t('settings.voiceSample'),
          style: field,
        }),
      ]}),
      jsxs('div', { style: { display: 'flex', gap: '10px', marginTop: '24px' }, children: [
        jsx('button', {
          type: 'button',
          onClick: handleSave,
          style: PRIMARY_PILL,
          children: t('settings.save'),
        }),
        jsx('button', {
          type: 'button',
          onClick: handleTest,
          disabled: testing,
          style: { ...GHOST_BTN, opacity: testing ? 0.6 : 1 },
          children: testing ? t('settings.testing') : t('settings.test'),
        }),
      ]}),
      statusMsg
        ? jsx('div', {
            style: { marginTop: '12px', fontSize: '12.5px', color: 'var(--ui-green)' },
            children: statusMsg,
          })
        : null,
      testResult
        ? jsx('div', {
            style: {
              marginTop: '12px',
              fontSize: '12.5px',
              color: testResult.ok ? 'var(--ui-green)' : 'var(--ui-red)',
            },
            children: testResult.ok
              ? t('settings.testSuccess')
              : `${t('settings.testFailed')}: ${testResult.error}`,
          })
        : null,
      testResult && testResult.ok && testResult.src
        ? jsx('div', {
            style: { marginTop: '10px' },
            children: jsx(MediaImage, {
              src: testResult.src,
              alt: t('settings.testSuccess'),
              style: {
                maxWidth: '280px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border)',
              },
            }),
          })
        : null,
    ],
  })
}

// ---------------------------------------------------------------------------
