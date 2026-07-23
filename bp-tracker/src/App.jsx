import { useEffect, useState, useCallback } from 'react'
import { supabase, hasSupabaseConfig } from './lib/supabase.js'
import {
  detectTimeOfDay,
  isCrisis,
  classify,
  clampSystolic,
  clampDiastolic,
  formatDateTime,
} from './lib/bp.js'
import { enableReminders, reminderState } from './lib/push.js'
import BigNumberField from './components/BigNumberField.jsx'
import TimeOfDayToggle from './components/TimeOfDayToggle.jsx'
import CrisisAlert from './components/CrisisAlert.jsx'
import InsightCard from './components/InsightCard.jsx'
import TipsView from './components/TipsView.jsx'

// Friendly text for the error slugs create-google-doc can return.
const EXPORT_MESSAGES = {
  google_not_configured:
    'Doctor export isn’t set up yet — the Google connection still needs to be added.',
  bad_service_account_json:
    'The Google account key looks malformed — please re-paste the full JSON.',
  query_failed: 'Could not read your readings just now. Please try again.',
  export_failed: 'The Google export hit a snag. Please try again in a moment.',
}

const TONE_COLOR = {
  normal: 'text-emerald-400',
  elevated: 'text-yellow-300',
  stage1: 'text-orange-400',
  stage2: 'text-red-400',
  crisis: 'text-red-300',
}

export default function App() {
  const [systolic, setSystolic] = useState(120)
  const [diastolic, setDiastolic] = useState(80)
  const [timeOfDay, setTimeOfDay] = useState(detectTimeOfDay())
  const [notes, setNotes] = useState('')

  const [saveState, setSaveState] = useState('idle') // idle | saving | saved | error
  const [recent, setRecent] = useState([])

  const [exportState, setExportState] = useState('idle') // idle | working | done | error
  const [docUrl, setDocUrl] = useState('')
  const [exportError, setExportError] = useState('')

  const [reminders, setReminders] = useState('off') // off | on | denied | unsupported | working
  const [view, setView] = useState('log') // log | tips

  const crisis = isCrisis(systolic, diastolic)
  const category = classify(systolic, diastolic)

  const loadRecent = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase
      .from('bp_logs')
      .select('id, systolic, diastolic, time_of_day, notes, created_at')
      .order('created_at', { ascending: false })
      .limit(5)
    if (!error && data) setRecent(data)
  }, [])

  useEffect(() => {
    // Initial mount fetch. Both setState calls resolve asynchronously (after
    // await / promise resolution), not synchronously in the effect body, so
    // they do not cause cascading renders — the rule is over-firing here.
    /* eslint-disable react-hooks/set-state-in-effect */
    loadRecent()
    reminderState().then(setReminders)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [loadRecent])

  async function handleSave() {
    if (saveState === 'saving') return
    if (!systolic || !diastolic) {
      setSaveState('error')
      return
    }
    setSaveState('saving')
    const { error } = await supabase.from('bp_logs').insert({
      systolic: clampSystolic(systolic),
      diastolic: clampDiastolic(diastolic),
      time_of_day: timeOfDay,
      notes: notes.trim() || null,
    })
    if (error) {
      console.error('[bp-tracker] save failed:', error)
      setSaveState('error')
      return
    }
    setSaveState('saved')
    setNotes('')
    loadRecent()
    if (navigator.vibrate) navigator.vibrate(40)
    setTimeout(() => setSaveState('idle'), 2200)
  }

  async function handleExport() {
    if (exportState === 'working') return
    setExportState('working')
    setExportError('')
    setDocUrl('')
    try {
      const { data, error } = await supabase.functions.invoke('create-google-doc', {
        body: {},
      })
      if (error) {
        // supabase-js wraps HTTP errors; the real slug is in the response body.
        let slug = ''
        try {
          slug = (await error.context?.json())?.error
        } catch {
          /* body not JSON — fall through to the generic message */
        }
        throw new Error(
          EXPORT_MESSAGES[slug] || 'Could not create the document. Please try again.',
        )
      }
      if (!data?.doc_url) throw new Error('No document link returned.')
      setDocUrl(data.doc_url)
      setExportState('done')
    } catch (err) {
      console.error('[bp-tracker] export failed:', err)
      setExportError(
        err?.message || 'Could not create the document. Please try again.',
      )
      setExportState('error')
    }
  }

  async function handleReminders() {
    setReminders('working')
    const res = await enableReminders()
    if (res.ok) setReminders('on')
    else setReminders(res.reason === 'denied' ? 'denied' : 'off')
  }

  // Missing build-time config → show a readable notice instead of a blank screen.
  if (!hasSupabaseConfig) {
    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center safe-pad px-6 text-center">
        <div className="text-5xl">⚙️</div>
        <h1 className="mt-4 font-display text-4xl tracking-wide text-bbf-gold">
          Almost there
        </h1>
        <p className="mt-3 text-lg leading-snug text-white/70">
          This app still needs its database keys. In the Render dashboard, add{' '}
          <span className="font-semibold text-white">VITE_SUPABASE_URL</span> and{' '}
          <span className="font-semibold text-white">VITE_SUPABASE_ANON_KEY</span>,
          then redeploy.
        </p>
        <p className="mt-3 text-sm text-white/40">
          (Keys are baked in at build time, so a rebuild is required after setting
          them.)
        </p>
      </div>
    )
  }

  // Full tips & guidance screen.
  if (view === 'tips') {
    return (
      <TipsView
        systolic={systolic}
        diastolic={diastolic}
        onBack={() => setView('log')}
      />
    )
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col safe-pad px-4">
      {/* Header */}
      <header className="pt-2 pb-3 text-center">
        <h1 className="font-display text-4xl tracking-wide text-bbf-gold">
          Blood Pressure
        </h1>
        <p className="text-white/45">
          {new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </header>

      <TimeOfDayToggle value={timeOfDay} onChange={setTimeOfDay} />

      {/* Inputs */}
      <div className="mt-3 space-y-3">
        <BigNumberField
          label="Systolic"
          value={systolic}
          onChange={setSystolic}
          clamp={clampSystolic}
          accent="purple"
        />
        <BigNumberField
          label="Diastolic"
          value={diastolic}
          onChange={setDiastolic}
          clamp={clampDiastolic}
          accent="gold"
        />
      </div>

      {/* Live category chip */}
      {category.label && (
        <p className="mt-3 text-center font-display text-2xl tracking-wide">
          <span className={TONE_COLOR[category.tone]}>{category.label}</span>
        </p>
      )}

      {/* Crisis alert */}
      {crisis && (
        <div className="mt-3">
          <CrisisAlert />
        </div>
      )}

      {/* Contextual guidance for this reading */}
      <div className="mt-3">
        <InsightCard
          systolic={systolic}
          diastolic={diastolic}
          onSeeAll={() => setView('tips')}
        />
      </div>

      {/* Notes */}
      <label className="mt-3 block">
        <span className="sr-only">Notes</span>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={140}
          placeholder="Notes (optional) — e.g. felt dizzy, after coffee"
          className="w-full rounded-2xl bg-bbf-ink/80 px-4 py-4 text-lg text-white placeholder-white/35 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-bbf-purple"
        />
      </label>

      {/* Save */}
      <button
        type="button"
        onClick={handleSave}
        disabled={saveState === 'saving'}
        className={
          'mt-3 w-full rounded-2xl py-6 font-display text-4xl tracking-wide shadow-xl transition ' +
          (saveState === 'saved'
            ? 'bg-emerald-500 text-white'
            : saveState === 'error'
              ? 'bg-crisis text-white'
              : 'bg-bbf-purple text-white active:scale-[0.98] active:bg-bbf-purple-deep')
        }
      >
        {saveState === 'saving'
          ? 'Saving…'
          : saveState === 'saved'
            ? '✓ Saved!'
            : saveState === 'error'
              ? 'Try again'
              : 'Save Reading'}
      </button>

      {/* Export for doctor */}
      <button
        type="button"
        onClick={handleExport}
        disabled={exportState === 'working'}
        className="mt-3 w-full rounded-2xl border-2 border-bbf-gold bg-transparent py-4 font-display text-2xl tracking-wide text-bbf-gold transition active:scale-[0.98] active:bg-bbf-gold/10"
      >
        {exportState === 'working'
          ? 'Building document…'
          : '📄 Export Google Doc for Doctor'}
      </button>

      {exportState === 'done' && docUrl && (
        <a
          href={docUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block w-full rounded-2xl bg-emerald-500/15 px-4 py-3 text-center text-lg font-semibold text-emerald-300 ring-1 ring-emerald-400/40"
        >
          ✓ Document ready — tap to open
        </a>
      )}
      {exportState === 'error' && (
        <p className="mt-2 text-center text-red-300">{exportError}</p>
      )}

      {/* Reminders */}
      <div className="mt-4 text-center">
        {reminders === 'on' ? (
          <p className="text-white/50">🔔 Reminders are on (3 AM &amp; 6 PM)</p>
        ) : reminders === 'denied' ? (
          <p className="text-white/40">
            Notifications are blocked. Enable them in your phone settings to get
            reminders.
          </p>
        ) : reminders === 'unsupported' ? null : (
          <button
            type="button"
            onClick={handleReminders}
            disabled={reminders === 'working'}
            className="text-lg font-semibold text-bbf-gold underline underline-offset-4"
          >
            {reminders === 'working'
              ? 'Enabling…'
              : '🔔 Turn on daily reminders'}
          </button>
        )}
      </div>

      {/* Recent readings */}
      {recent.length > 0 && (
        <section className="mt-5 mb-4">
          <h3 className="font-display text-xl tracking-wide text-white/40">
            Recent
          </h3>
          <ul className="mt-2 space-y-2">
            {recent.map((r) => {
              const c = classify(r.systolic, r.diastolic)
              return (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-xl bg-bbf-ink/70 px-4 py-3 ring-1 ring-white/5"
                >
                  <span className="font-display text-2xl tabular-nums text-white">
                    {r.systolic}
                    <span className="text-white/30">/</span>
                    {r.diastolic}
                  </span>
                  <span className="flex items-center gap-2 text-right text-sm text-white/45">
                    <span className={TONE_COLOR[c.tone]}>{c.label}</span>
                    <span>
                      {r.time_of_day === 'morning' ? '☀️' : '🌙'}{' '}
                      {formatDateTime(r.created_at)}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <footer className="mt-auto py-4 text-center text-xs text-white/25">
        Build Believe Fit · Private BP log
      </footer>
    </div>
  )
}
