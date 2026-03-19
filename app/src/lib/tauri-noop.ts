// Noop module for web builds - Tauri invoke is not available
export async function invoke(): Promise<never> {
  throw new Error("Tauri invoke not available in web mode");
}
