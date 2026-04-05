
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
    } catch (error: any) {
      clearTimeout(id);
      if (error.name === 'AbortError') {
        console.error(`Supabase Request Timeout (${timeout}ms): ${input.toString()}`);
      }
      throw error;
    }
  };
};

export async function safeSupabaseFetch<T>(queryFactory: () => any, retries = 3): Promise<{ data: T | null; error: any }> {
  let lastError = null
  let attempt = 0
  
  while (attempt < retries) {
    try {
      const result = await queryFactory()
      if (!result.error) return result
      
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
      return result
    } catch (e: any) {
      lastError = e
      const isNetworkError = e.name === 'AbortError' || 
                            e.message?.includes('ECONNRESET') || 
                            e.message?.includes('fetch failed') ||
                            e.message?.includes('aborted');
                            
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
