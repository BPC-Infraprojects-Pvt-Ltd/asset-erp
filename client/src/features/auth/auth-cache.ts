import type { QueryClient } from "@tanstack/react-query";

export async function clearProtectedCache(
  queryClient: QueryClient,
): Promise<void> {
  await queryClient.cancelQueries({ queryKey: ["protected"] });
  queryClient.removeQueries({ queryKey: ["protected"] });
}
