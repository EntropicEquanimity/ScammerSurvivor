// The hand feel: a short haptic where the phone allows it, and the tap origin for zoom transitions.
export function haptic(ms = 10): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Not every phone allows it, and the practice works without it.
  }
}

// Records where the player tapped so the next sheet can grow out of that point.
export function rememberTap(event: { clientX: number; clientY: number }): void {
  const root = document.documentElement;
  root.style.setProperty('--tap-x', `${(event.clientX / window.innerWidth) * 100}%`);
  root.style.setProperty('--tap-y', `${(event.clientY / window.innerHeight) * 100}%`);
}
