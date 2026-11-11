/**
 * Style Presets and Personal Persona Management
 * Custom styles, presets, active style selection, and writing rules.
 */

import { jsx, jsxs } from 'react/jsx-runtime'
import React, {
  useState,
  useContext,
  useMemo,
} from 'react'
import { AppContext } from './app.js'
import { GHOST_BTN, PRIMARY_PILL, SECONDARY_PILL, STYLE_CATEGORIES } from './constants.js'

// 10d. Style Library Page (Task 22, Requirements 12.9, 15.2)
// ---------------------------------------------------------------------------

export function StylePage() {
  const { state, dispatch, rest, t, localeTag } = useContext(AppContext)
  const styles = (state.serverState && state.serverState.styles) || []
  const skills = (state.serverState && state.serverState.skills) || []
  const activeStyleId = state.serverState && state.serverState.activeStyleId
  const activeStyle = styles.find(s => s.id === activeStyleId) || null

  const [showAddModal, setShowAddModal] = useState(false)
  const [editingStyle, setEditingStyle] = useState(null)
  const [formData, setFormData] = useState({ name: '', category: 'General', summary: '', tone: '' })
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [postText, setPostText] = useState('')
  const [linkText, setLinkText] = useState('')
  const [extracting, setExtracting] = useState('')
  const [extractMsg, setExtractMsg] = useState('')
  const [extractError, setExtractError] = useState('')
  const [opError, setOpError] = useState('')

  const runOp = op =>
    rest('/ops', { method: 'POST', body: JSON.stringify({ ops: [op] }) })
      .then(res => {
        if (res && res.state) dispatch({ type: 'SET_STATE', payload: res.state })
      })
      .catch(err => {
        setOpError((err && err.message) || String(err))
      })

  const handleSelectStyle = styleId => {
    setOpError('')
    runOp({ op: 'set_style', id: styleId })
  }

  const handleSaveStyle = () => {
    if (!formData.name.trim()) return
    setOpError('')
    const op = editingStyle
      ? { op: 'update_style', id: editingStyle.id, ...formData }
      : { op: 'add_style', ...formData }
    rest('/ops', { method: 'POST', body: JSON.stringify({ ops: [op] }) })
      .then(res => {
        if (res && res.state) dispatch({ type: 'SET_STATE', payload: res.state })
        setShowAddModal(false)
        setEditingStyle(null)
        setFormData({ name: '', category: 'General', summary: '', tone: '' })
      })
      .catch(err => setOpError((err && err.message) || String(err)))
  }

  const handleDeleteStyle = styleId => {
    setOpError('')
    runOp({ op: 'delete_style', id: styleId })
  }

  const handleToggleSkill = skill => {
    setOpError('')
    const nextStatus = skill.status === 'active' ? 'inactive' : 'active'
    runOp({ op: 'update_skill', id: skill.id, status: nextStatus })
  }

  const handleDeleteSkill = skillId => {
    setOpError('')
    runOp({ op: 'delete_skill', id: skillId })
  }

  const runExtract = payload => {
    setExtracting(payload.urls ? 'links' : 'posts')
    setExtractError('')
    setExtractMsg('')
    rest('/style/extract', { method: 'POST', body: JSON.stringify(payload) })
      .then(res => {
        setExtracting('')
        if (res && res.state) dispatch({ type: 'SET_STATE', payload: res.state })
        setExtractMsg(t('style.extractDone'))
        if (payload.urls) setLinkText('')
        else setPostText('')
      })
      .catch(err => {
        setExtracting('')
        setExtractError((err && err.message) || String(err))
      })
  }

  const categories = useMemo(() => {
    const cats = {}
    styles.forEach(s => {
      const cat = s.category || 'Other'
      if (!cats[cat]) cats[cat] = []
      cats[cat].push(s)
    })
    return cats
  }, [styles])
  const categoryNames = Object.keys(categories)
  const visibleStyles =
    categoryFilter === 'all' ? styles : styles.filter(s => (s.category || 'Other') === categoryFilter)

  const pageInput = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    backgroundColor: 'color-mix(in srgb, var(--color-foreground) 4%, var(--color-background))',
    color: 'var(--color-foreground)',
    fontSize: '12.5px',
    outline: 'none',
  }
  const panelStyle = {
    backgroundColor: 'var(--color-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-xl)',
    padding: '20px',
    boxShadow: 'var(--shadow-sm)',
  }

  return jsxs('div', {
    className: 'md-board-page',
    style: {
      flex: 1,
      height: '100%',
      overflowY: 'auto',
      padding: '12px 24px 40px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      backgroundColor: 'var(--ui-bg-chrome, var(--color-background))',
    },
    children: [
      // Header + add button.
      jsxs('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        },
        children: [
          jsx('h1', {
            style: {
              fontSize: '28px',
              fontWeight: 400,
              letterSpacing: '-0.02em',
              color: 'var(--color-foreground)',
              margin: 0,
            },
            children: t('style.title'),
          }),
          jsx('button', {
            type: 'button',
            onClick: () => {
              setEditingStyle(null)
              setFormData({ name: '', category: 'General', summary: '', tone: '' })
              setShowAddModal(true)
            },
            style: PRIMARY_PILL,
            children: t('style.addBtn'),
          }),
        ],
      }),
      // Active style hero sentence.
      activeStyle
        ? jsx('div', {
            style: {
              ...HERO_GRADIENT,
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)',
              padding: '14px 20px',
              fontSize: '15px',
              color: 'var(--color-foreground)',
            },
            children: [
              `${t('style.writingPrefix')} `,
              jsx('span', { style: { fontFamily: SERIF_FONT, fontWeight: 600 }, children: activeStyle.name || '—' }),
              ` ${t('style.writingSuffix')}`,
            ],
          })
        : null,
      opError
        ? jsx('div', {
            style: {
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'color-mix(in srgb, var(--ui-red) 10%, var(--color-background))',
              color: 'var(--ui-red)',
              fontSize: '12px',
            },
            children: opError,
          })
        : null,
      // Extraction cards: paste posts or paste links.
      jsxs('div', {
        style: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' },
        children: [
          jsxs('div', { style: panelStyle, children: [
            jsx('h2', {
              style: { fontSize: '13.5px', fontWeight: 600, margin: '0 0 10px', color: 'var(--color-foreground)' },
              children: t('style.pastePostsTitle'),
            }),
            jsx('textarea', {
              rows: 4,
              value: postText,
              onChange: e => setPostText(e.target.value),
              placeholder: t('style.pastePosts'),
              style: { ...pageInput, resize: 'vertical', fontFamily: 'inherit' },
            }),
            jsx('button', {
              type: 'button',
              onClick: () => runExtract({ text: postText.trim() }),
              disabled: extracting === 'posts' || !postText.trim(),
              style: {
                ...SECONDARY_PILL,
                alignSelf: 'flex-start',
                marginTop: '10px',
                opacity: extracting === 'posts' || !postText.trim() ? 0.55 : 1,
              },
              children: extracting === 'posts' ? t('style.extracting') : t('style.pastePosts'),
            }),
          ]}),
          jsxs('div', { style: panelStyle, children: [
            jsx('h2', {
              style: { fontSize: '13.5px', fontWeight: 600, margin: '0 0 10px', color: 'var(--color-foreground)' },
              children: t('style.pasteLinksTitle'),
            }),
            jsx('textarea', {
              rows: 4,
              value: linkText,
              onChange: e => setLinkText(e.target.value),
              placeholder: t('style.pasteLinksPlaceholder'),
              style: { ...pageInput, resize: 'vertical', fontFamily: 'inherit' },
            }),
            jsx('button', {
              type: 'button',
              onClick: () =>
                runExtract({ urls: linkText.split(/\r?\n/).map(s => s.trim()).filter(Boolean) }),
              disabled: extracting === 'links' || !linkText.trim(),
              style: {
                ...SECONDARY_PILL,
                alignSelf: 'flex-start',
                marginTop: '10px',
                opacity: extracting === 'links' || !linkText.trim() ? 0.55 : 1,
              },
              children: extracting === 'links' ? t('style.extracting') : t('style.pasteLinks'),
            }),
          ]}),
        ],
      }),
      (extractMsg || extractError) && !extracting
        ? jsx('div', {
            style: {
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: extractError
                ? 'color-mix(in srgb, var(--ui-red) 10%, var(--color-background))'
                : 'color-mix(in srgb, var(--ui-green) 10%, var(--color-background))',
              color: extractError ? 'var(--ui-red)' : 'var(--ui-green)',
              fontSize: '12px',
            },
            children: extractError || extractMsg,
          })
        : null,
      // Add / edit style form.
      showAddModal
        ? jsxs('div', {
            style: { ...panelStyle, display: 'flex', flexDirection: 'column', gap: '10px' },
            children: [
              jsx('h4', {
                style: { margin: 0, fontSize: '13.5px', fontWeight: 600, color: 'var(--color-foreground)' },
                children: editingStyle ? t('style.editBtn') : t('style.addBtn'),
              }),
              jsxs('div', {
                style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
                children: [
                  jsx('input', {
                    type: 'text',
                    placeholder: t('style.name'),
                    value: formData.name,
                    onChange: e => setFormData({ ...formData, name: e.target.value }),
                    style: pageInput,
                  }),
                  jsx('input', {
                    type: 'text',
                    placeholder: t('style.category'),
                    value: formData.category,
                    onChange: e => setFormData({ ...formData, category: e.target.value }),
                    style: pageInput,
                  }),
                ],
              }),
              jsx('input', {
                type: 'text',
                placeholder: t('style.summary'),
                value: formData.summary,
                onChange: e => setFormData({ ...formData, summary: e.target.value }),
                style: pageInput,
              }),
              jsx('input', {
                type: 'text',
                placeholder: t('style.tone'),
                value: formData.tone,
                onChange: e => setFormData({ ...formData, tone: e.target.value }),
                style: pageInput,
              }),
              jsxs('div', {
                style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' },
                children: [
                  jsx('button', {
                    type: 'button',
                    onClick: () => setShowAddModal(false),
                    style: GHOST_BTN,
                    children: t('style.cancel'),
                  }),
                  jsx('button', {
                    type: 'button',
                    onClick: handleSaveStyle,
                    style: PRIMARY_PILL,
                    children: t('style.save'),
                  }),
                ],
              }),
            ],
          })
        : null,
      // My styles: category pills + card grid.
      jsxs('div', {
        style: { display: 'flex', flexDirection: 'column', gap: '12px' },
        children: [
          jsx('h2', {
            style: { fontSize: '15px', fontWeight: 600, margin: 0, color: 'var(--color-foreground)' },
            children: t('style.myStyles'),
          }),
          categoryNames.length > 0
            ? jsx('div', {
                style: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
                children: ['all'].concat(categoryNames).map(cat =>
                  jsx(
                    'button',
                    {
                      key: cat,
                      type: 'button',
                      onClick: () => setCategoryFilter(cat),
                      style: {
                        padding: '4px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        cursor: 'pointer',
                        fontSize: '11.5px',
                        fontWeight: 500,
                        backgroundColor:
                          categoryFilter === cat
                            ? 'var(--theme-primary, var(--ui-accent, var(--ui-blue)))'
                            : 'var(--color-card)',
                        color:
                          categoryFilter === cat
                            ? 'var(--theme-primary-foreground, var(--color-primary-foreground, white))'
                            : 'var(--ui-text-tertiary)',
                      },
                      children: cat === 'all' ? t('home.all') : cat,
                    },
                    `cat-${cat}`
                  )
                ),
              })
            : null,
          jsx('div', {
            style: {
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
              gap: '12px',
            },
            children: visibleStyles.map(st => {
              const isActive = activeStyleId === st.id
              const isPreset = Boolean(st.preset)
              return jsxs(
                'div',
                {
                  key: st.id,
                  onClick: () => handleSelectStyle(st.id),
                  style: {
                    padding: '14px',
                    borderRadius: 'var(--radius-lg)',
                    border: isActive
                      ? '2px solid var(--theme-primary, var(--ui-accent, var(--ui-blue)))'
                      : '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-card)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '10px',
                    boxShadow: 'var(--shadow-sm)',
                  },
                  children: [
                    jsxs('div', {
                      children: [
                        jsxs('div', {
                          style: {
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '6px',
                            gap: '8px',
                          },
                          children: [
                            jsx('span', {
                              style: {
                                fontWeight: 600,
                                fontSize: '13px',
                                color: 'var(--color-foreground)',
                              },
                              children: st.name || '—',
                            }),
                            jsx('span', {
                              style: {
                                fontSize: '10.5px',
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-sm)',
                                flexShrink: 0,
                                backgroundColor: isPreset
                                  ? 'color-mix(in srgb, var(--color-foreground) 6%, var(--color-background))'
                                  : 'color-mix(in srgb, var(--ui-blue) 14%, var(--color-background))',
                                color: isPreset
                                  ? 'var(--ui-text-tertiary)'
                                  : 'color-mix(in srgb, var(--ui-blue) 85%, var(--color-foreground))',
                              },
                              children: isPreset ? t('style.preset') : t('style.custom'),
                            }),
                          ],
                        }),
                        st.summary
                          ? jsx('div', {
                              style: {
                                fontSize: '11.5px',
                                color: 'var(--ui-text-tertiary)',
                                lineHeight: 1.45,
                              },
                              children: st.summary,
                            })
                          : null,
                        st.tone
                          ? jsx('div', {
                              style: {
                                fontSize: '11.5px',
                                color: 'var(--ui-text-secondary)',
                                marginTop: '4px',
                              },
                              children: `${t('style.tone')}: ${st.tone}`,
                            })
                          : null,
                      ],
                    }),
                    jsxs('div', {
                      style: {
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingTop: '8px',
                        borderTop: '1px solid color-mix(in srgb, var(--color-border) 60%, transparent)',
                      },
                      children: [
                        jsx('span', {
                          style: {
                            fontSize: '11px',
                            fontWeight: 600,
                            color: isActive ? 'var(--ui-green)' : 'var(--ui-text-quaternary)',
                          },
                          children: isActive ? t('style.inUse') : t('style.useThis'),
                        }),
                        !isPreset
                          ? jsxs('div', {
                              onClick: e => e.stopPropagation(),
                              style: { display: 'flex', gap: '6px' },
                              children: [
                                jsx('button', {
                                  type: 'button',
                                  onClick: () => {
                                    setEditingStyle(st)
                                    setFormData({
                                      name: st.name || '',
                                      category: st.category || 'General',
                                      summary: st.summary || '',
                                      tone: st.tone || '',
                                    })
                                    setShowAddModal(true)
                                  },
                                  style: {
                                    padding: '2px 8px',
                                    fontSize: '11px',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--color-border)',
                                    backgroundColor: 'var(--color-background)',
                                    color: 'var(--ui-text-secondary)',
                                    cursor: 'pointer',
                                  },
                                  children: t('style.editBtn'),
                                }),
                                jsx('button', {
                                  type: 'button',
                                  onClick: () => handleDeleteStyle(st.id),
                                  style: {
                                    padding: '2px 8px',
                                    fontSize: '11px',
                                    borderRadius: 'var(--radius-md)',
                                    border: 'none',
                                    backgroundColor:
                                      'color-mix(in srgb, var(--ui-red) 12%, var(--color-background))',
                                    color: 'var(--ui-red)',
                                    cursor: 'pointer',
                                  },
                                  children: t('style.deleteBtn'),
                                }),
                              ],
                            })
                          : null,
                      ],
                    }),
                  ],
                },
                st.id
              )
            }),
          }),
        ],
      }),
      // Skill rules list.
      jsxs('div', {
        style: { ...panelStyle, display: 'flex', flexDirection: 'column', gap: '10px' },
        children: [
          jsx('h4', {
            style: { margin: 0, fontSize: '13.5px', fontWeight: 600, color: 'var(--color-foreground)' },
            children: t('style.skillsTitle'),
          }),
          skills.length === 0
            ? jsx('div', {
                style: { color: 'var(--ui-text-quaternary)', fontSize: '12px' },
                children: t('style.noSkills'),
              })
            : jsx('div', {
                style: { display: 'flex', flexDirection: 'column', gap: '8px' },
                children: skills.map(sk => {
                  const active = sk.status === 'active' || sk.status === 'exported'
                  return jsxs(
                    'div',
                    {
                      key: sk.id,
                      style: {
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid color-mix(in srgb, var(--color-border) 60%, transparent)',
                        backgroundColor:
                          'var(--color-card)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '14px',
                      },
                      children: [
                        jsxs('div', {
                          style: { flex: 1, display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 },
                          children: [
                            jsx('span', {
                              style: {
                                fontSize: '10.5px',
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-sm)',
                                flexShrink: 0,
                                backgroundColor: active
                                  ? 'color-mix(in srgb, var(--ui-green) 14%, var(--color-card))'
                                  : 'color-mix(in srgb, var(--color-foreground) 6%, var(--color-card))',
                                color: active ? 'var(--ui-green)' : 'var(--ui-text-tertiary)',
                                fontWeight: 600,
                              },
                              children: sk.status || 'proposed',
                            }),
                            jsxs('div', {
                              style: { display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 },
                              children: [
                                jsx('span', {
                                  style: {
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: 'var(--color-foreground)',
                                  },
                                  children: sk.name || sk.rule || sk.text || 'Rule',
                                }),
                                sk.rule && sk.name
                                  ? jsx('span', {
                                      style: {
                                        fontSize: '11.5px',
                                        color: 'var(--ui-text-secondary)',
                                        lineHeight: 1.4,
                                      },
                                      children: sk.rule,
                                    })
                                  : null,
                                sk.evidence
                                  ? jsx('span', {
                                      style: {
                                        fontSize: '10.5px',
                                        color: 'var(--ui-text-quaternary)',
                                      },
                                      children: sk.evidence,
                                    })
                                  : null,
                              ],
                            }),
                          ],
                        }),
                        jsxs('div', {
                          style: { display: 'flex', gap: '6px', flexShrink: 0 },
                          children: [
                            jsx('button', {
                              type: 'button',
                              onClick: () => handleToggleSkill(sk),
                              style: {
                                padding: '3px 10px',
                                fontSize: '11px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--color-border)',
                                backgroundColor: 'var(--color-card)',
                                color: 'var(--ui-text-secondary)',
                                cursor: 'pointer',
                              },
                              children: sk.status === 'active'
                                ? t('style.skillDeactivate')
                                : t('style.skillActivate'),
                            }),
                            jsx('button', {
                              type: 'button',
                              onClick: () => handleDeleteSkill(sk.id),
                              style: {
                                padding: '3px 10px',
                                fontSize: '11px',
                                borderRadius: 'var(--radius-md)',
                                border: 'none',
                                backgroundColor:
                                  'color-mix(in srgb, var(--ui-red) 12%, var(--color-background))',
                                color: 'var(--ui-red)',
                                cursor: 'pointer',
                              },
                              children: t('style.skillDelete'),
                            }),
                          ],
                        }),
                      ],
                    },
                    sk.id
                  )
                }),
              }),
        ],
      }),
    ],
  })
}

// ---------------------------------------------------------------------------
