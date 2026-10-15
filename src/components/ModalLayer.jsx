import { useEffect, useRef } from 'react'

const FOCUSABLE = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])'

// One manager serves every council and optional dialog, including focus restoration.
export default function ModalLayer({ children, backgroundRef, onClose, modalKey }) {
  const layerRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    const layer = layerRef.current
    const dialog = layer?.querySelector('[role="dialog"]')
    if (!dialog) return undefined
    const previous = document.activeElement
    const background = backgroundRef.current
    const originalOverflow = document.body.style.overflow
    const wasInert = background?.inert ?? false
    const oldAriaHidden = background?.getAttribute('aria-hidden')
    if (background) { background.inert = true; background.setAttribute('aria-hidden', 'true') }
    document.body.style.overflow = 'hidden'
    dialog.tabIndex = -1
    const candidates = () => [...dialog.querySelectorAll(FOCUSABLE)].filter((item) => item.getClientRects().length && !item.closest('[hidden]'))
    const first = candidates()[0] ?? dialog
    first.focus({ preventScroll: true })
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && onCloseRef.current) { event.preventDefault(); event.stopPropagation(); onCloseRef.current(); return }
      if (event.key !== 'Tab') return
      const controls = candidates()
      if (!controls.length) { event.preventDefault(); dialog.focus(); return }
      const firstControl = controls[0]
      const lastControl = controls.at(-1)
      if (event.shiftKey && (document.activeElement === firstControl || !dialog.contains(document.activeElement))) { event.preventDefault(); lastControl.focus() }
      else if (!event.shiftKey && (document.activeElement === lastControl || !dialog.contains(document.activeElement))) { event.preventDefault(); firstControl.focus() }
    }
    const onFocusIn = (event) => { if (!dialog.contains(event.target)) (candidates()[0] ?? dialog).focus({ preventScroll: true }) }
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('focusin', onFocusIn)
      document.body.style.overflow = originalOverflow
      if (background) {
        background.inert = wasInert
        if (oldAriaHidden === null) background.removeAttribute('aria-hidden')
        else background.setAttribute('aria-hidden', oldAriaHidden)
      }
      if (previous?.isConnected && !previous.closest('[inert]')) previous.focus({ preventScroll: true })
    }
  }, [backgroundRef, modalKey])
  return <div ref={layerRef} className="dialog-layer">{children}</div>
}
