let lockCount = 0;
let lockedScrollY = 0;

export function lockBodyScroll(): void {
  lockCount += 1;
  if (lockCount > 1) {
    return;
  }

  lockedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
  document.documentElement.classList.add('scroll-locked');
  document.body.classList.add('scroll-locked');
  document.body.style.top = `-${lockedScrollY}px`;
}

export function unlockBodyScroll(): void {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount > 0) {
    return;
  }

  document.documentElement.classList.remove('scroll-locked');
  document.body.classList.remove('scroll-locked');
  document.body.style.top = '';
  window.scrollTo(0, lockedScrollY);
}

export function clearBodyScrollLocks(): void {
  lockCount = 0;
  document.documentElement.classList.remove('scroll-locked');
  document.body.classList.remove('scroll-locked');
  document.body.style.top = '';
  document.body.style.overflow = '';
}
