
export const supabaseFetchWithTimeout = (timeout = 20000) => {
  return async (input: string | URL | Request, init?: RequestInit) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal
      });
      clearTimeout(id);
      return response;
    } catch (error: unknown) {
      clearTimeout(id);
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`Supabase Request Timeout (${timeout}ms): ${input.toString()}`);
      }
      throw error;
    }
  };
};

export async function safeSupabaseFetch<T>(queryFactory: () => PromiseLike<{ data: unknown; error: unknown }>, retries = 3): Promise<{ data: T | null; error: unknown | null }> {
  let lastError: unknown = null
  let attempt = 0
  
  while (attempt < retries) {
    try {
      const result = await queryFactory()
      if (!result.error) return result as { data: T | null; error: unknown }
      
      lastError = result.error
      const errStr = JSON.stringify(lastError)
      
      if (errStr.includes('ECONNRESET') || errStr.includes('fetch failed') || errStr.includes('abort') || errStr.includes('timeout')) {
        attempt++
        if (attempt < retries) {
          console.warn(`Supabase fetch failed (network/timeout), retrying... (${retries - attempt} left)`)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
          continue
        }
      }
      return result as { data: T | null; error: unknown }
    } catch (e: unknown) {
      lastError = e
      const err = e as Error
      const isNetworkError = err.name === 'AbortError' ||
                            err.message?.includes('ECONNRESET') ||
                            err.message?.includes('fetch failed') ||
                            err.message?.includes('aborted');
                            
      if (isNetworkError) {
        attempt++
        if (attempt < retries) {
          console.warn(`Supabase fetch exception (network/timeout), retrying... (${retries - attempt} left)`)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
          continue
        }
      }
      return { data: null, error: e }
    }
  }
  return { data: null, error: lastError }
}
