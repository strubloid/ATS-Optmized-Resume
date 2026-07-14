import { createApiApp } from "./app";
import { loadStoreSnapshot } from "./shared/persistence";
import { appStore } from "./shared/store";

const port = Number(process.env.API_PORT ?? 3333);
const host = process.env.API_HOST ?? "127.0.0.1";

await loadStoreSnapshot(appStore);

const app = createApiApp(appStore);

app.listen(port, host, () => {
  console.log(`CurriculumOptimizer API listening on http://${host}:${port}`);
});
