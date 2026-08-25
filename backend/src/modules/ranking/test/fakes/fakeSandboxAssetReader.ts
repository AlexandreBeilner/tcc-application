import type { SandboxAssetReader } from '../../application/ports/sandboxAssetReader'

export function createFakeSandboxAssetReader(sandboxAssetIds: string[] = []): SandboxAssetReader {
  return {
    async listSandboxAssetIds() {
      return new Set(sandboxAssetIds)
    },
  }
}
