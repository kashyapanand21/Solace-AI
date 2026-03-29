import { initSDK } from "../runanywhere";

let ready = false;

async function init() {
  if (!ready) {
    await initSDK();
    ready = true;
    console.log("[RunAnywhere] initialized");
  }
}

export async function embed(text: string): Promise<number[]> {
  await init();

  const sdk: any = (window as any).runanywhere;

  const res = await sdk.run({
    model: "bge-small-en",
    input: text
  });

  return res.embedding || res;
}
