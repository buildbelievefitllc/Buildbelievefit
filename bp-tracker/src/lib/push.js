import { supabase } from './supabase.js'

// VAPID public key (safe to expose). Set VITE_VAPID_PUBLIC_KEY in Render.
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''

let swRegistration = null

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', async () => {
    try {
      swRegistration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      })
    } catch (err) {
      console.warn('[bp-tracker] SW registration failed:', err)
    }
  })
}

export function pushSupported() {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    !!VAPID_PUBLIC_KEY
  )
}

// Base64url VAPID key → Uint8Array required by the Push API.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

async function getRegistration() {
  if (swRegistration) return swRegistration
  if ('serviceWorker' in navigator) {
    swRegistration = await navigator.serviceWorker.ready
  }
  return swRegistration
}

// Ask for permission, subscribe, and persist the subscription so the
// send-bp-reminder cron can reach this device. Returns { ok, reason? }.
export async function enableReminders() {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, reason: 'denied' }

  const reg = await getRegistration()
  if (!reg) return { ok: false, reason: 'no-sw' }

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }

  // Insert; the unique index on endpoint means a repeat device is a no-op.
  const { error } = await supabase
    .from('push_subscriptions')
    .insert({ subscription_data: sub.toJSON() })

  // 23505 = duplicate endpoint → already registered, treat as success.
  if (error && error.code !== '23505') {
    console.warn('[bp-tracker] Failed to persist subscription:', error)
    return { ok: false, reason: 'save-failed' }
  }
  return { ok: true }
}

export async function reminderState() {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await getRegistration()
  const sub = reg && (await reg.pushManager.getSubscription())
  return sub ? 'on' : 'off'
}
