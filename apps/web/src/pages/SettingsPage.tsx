import { useEffect, useState } from "react";
import type { ApiClient } from "../api/client";
import { Button } from "../shared/ui/Button";
import { Panel, TextField } from "../shared/ui/Field";

export function SettingsPage({ api }: { api: ApiClient }) {
  const [key, setKey] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [defaultModel, setDefaultModel] = useState("");
  const [configured, setConfigured] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => { api.getAiSettings().then((data) => { setModels(data.models); setDefaultModel(data.defaultModel); setConfigured(data.configured); }).catch((error) => setStatus(error.message)); }, []);
  async function saveKey() { setStatus("Loading available Zen and Go models..."); try { const data = await api.saveAiSettings({ apiKey: key }); setModels(data.models); setDefaultModel(data.defaultModel); setConfigured(data.configured); setKey(""); setStatus(`Saved. ${data.models.length} models available.`); } catch (error) { setStatus(error instanceof Error ? error.message : "Could not save key"); } }
  async function refresh() { setStatus("Refreshing models..."); try { const data = await api.refreshAiModels(); setModels(data.models); setStatus(`${data.models.length} models available.`); } catch (error) { setStatus(error instanceof Error ? error.message : "Could not refresh models"); } }
  async function saveDefault() { const data = await api.saveAiSettings({ defaultModel }); setDefaultModel(data.defaultModel); setStatus("Default model saved."); }
  return <div className="settings-page"><Panel><p className="product-label">AI configuration</p><h2>OpenCode model settings</h2><p>Use one OpenCode key to discover available Zen and Go models. The key stays on the server and is never returned to the browser.</p><div className="settings-status"><span className={configured ? "status-good" : "status-warn"}>{configured ? "Key configured" : "No key configured"}</span><span>{models.length} models discovered</span></div><TextField label="OpenCode API key" type="password" value={key} placeholder={configured ? "Key stored securely; enter a new key to replace it" : "sk-..."} onChange={(event) => setKey(event.target.value)} /><div className="button-row"><Button variant="primary" onClick={saveKey} disabled={!key.trim()}>Save key and load models</Button><Button onClick={refresh} disabled={!configured}>Refresh models</Button></div></Panel><Panel><h2>Default model</h2><p>This model is used for unsupported-requirement assistance and future AI rewrites.</p><select value={defaultModel} onChange={(event) => setDefaultModel(event.target.value)} disabled={!models.length}><option value="">Select a model</option>{models.map((model) => <option key={model} value={model}>{model}</option>)}</select><div className="button-row"><Button variant="primary" onClick={saveDefault} disabled={!defaultModel}>Save default model</Button></div>{status ? <p className="status-line" role="status">{status}</p> : null}</Panel></div>;
}
