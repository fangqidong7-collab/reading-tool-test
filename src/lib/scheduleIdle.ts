/** 在浏览器空闲时执行任务，不支持时回退到 setTimeout(0)。返回取消函数。 */
export function scheduleIdleTask(fn: () => void, timeoutMs = 2000): () => void {
  if (typeof requestIdleCallback !== 'undefined') {
    const id = requestIdleCallback(fn, { timeout: timeoutMs });
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(fn, 0);
  return () => clearTimeout(id);
}
