let updateServiceWorker = null;

export function setPwaUpdateServiceWorker(updateSW) {
  updateServiceWorker = typeof updateSW === 'function' ? updateSW : null;
}

export async function applyPwaUpdate() {
  if (!updateServiceWorker) return false;
  await updateServiceWorker(true);
  return true;
}
