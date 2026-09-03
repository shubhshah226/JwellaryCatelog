let lockCount = 0;

export function lockBodyScroll(): void {
  lockCount += 1;
  document.body.classList.add('scroll-locked');
}

export function unlockBodyScroll(): void {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.classList.remove('scroll-locked');
  }
}

export function clearBodyScrollLocks(): void {
  lockCount = 0;
  document.body.classList.remove('scroll-locked');
  document.body.style.overflow = '';
}
