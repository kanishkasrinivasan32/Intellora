import { useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  Cloud,
  Copy,
  Cpu,
  Database,
  HardDrive,
  KeyRound,
  LockKeyhole,
  Music2,
  Settings2,
  Share2,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { api } from "../lib/api";

type Props = {
  models: any;
  setModels: (models: any) => void;
  sound: boolean;
  setSound: (sound: boolean) => void;
  busy: string;
  online: boolean | null;
  onSave: () => void;
  onShare: () => void;
};

const providerCopy: Record<
  string,
  { title: string; detail: string; icon: typeof Cpu }
> = {
  auto: {
    title: "Smart routing",
    detail: "Ollama first for every task · your cloud providers are fallbacks",
    icon: Sparkles,
  },
  ollama: {
    title: "Local only",
    detail: "Keep generation on this laptop with installed Ollama models",
    icon: HardDrive,
  },
  gemini: {
    title: "Gemini cloud",
    detail: "Use the configured Google model for every AI task",
    icon: Cloud,
  },
  sarvam: {
    title: "Sarvam cloud",
    detail: "Use the configured Sarvam account for every AI task",
    icon: Cloud,
  },
  openrouter: {
    title: "OpenRouter cloud",
    detail: "Use one key to access your selected OpenRouter model",
    icon: Cloud,
  },
  groq: {
    title: "Groq cloud",
    detail: "Use Groq for fast OpenAI-compatible generation",
    icon: Cloud,
  },
};

const clouds = [
  { id: "gemini", label: "Gemini", placeholder: "AIza…" },
  { id: "openrouter", label: "OpenRouter", placeholder: "sk-or-v1-…" },
  { id: "groq", label: "Groq", placeholder: "gsk_…" },
  { id: "sarvam", label: "Sarvam", placeholder: "subscription key" },
];

export function SettingsView({
  models,
  setModels,
  sound,
  setSound,
  busy,
  online,
  onSave,
  onShare,
}: Props) {
  const [onboarding, setOnboarding] = useState<any>(null);
  useEffect(() => {
    api("/settings/onboarding")
      .then(setOnboarding)
      .catch(() => {});
  }, []);
  const provider =
    providerCopy[models?.provider || "auto"] || providerCopy.auto;
  const ProviderIcon = provider.icon;
  const updateKey = (id: string, value: string) =>
    setModels({
      ...models,
      api_keys: { ...(models.api_keys || {}), [id]: value },
    });
  const updateCloudModel = (id: string, value: string) =>
    setModels({
      ...models,
      cloud_models: { ...(models.cloud_models || {}), [id]: value },
    });
  return (
    <div className="settings-harbor">
      <section className="settings-captain-card">
        <div className="settings-avatar">K</div>
        <div>
          <span className="eyebrow">
            <UserRound size={14} /> YOUR CAPTAIN
          </span>
          <h2>Captain Kanishka</h2>
          <p>Straw Hat Scholar · learning locally aboard this device</p>
        </div>
        <span className={`settings-live ${online === false ? "offline" : ""}`}>
          <i />
          {online === false ? "Ship offline" : "Ship connected"}
        </span>
      </section>

      <div className="settings-card-grid">
        <section className="settings-card settings-ai-card">
          <div className="settings-card-icon">
            <ProviderIcon size={22} />
          </div>
          <div className="settings-card-copy">
            <span className="eyebrow">AI ROUTE</span>
            <h3>{provider.title}</h3>
            <p>{provider.detail}</p>
          </div>
          {models && (
            <form
              className="settings-form"
              onSubmit={(event) => {
                event.preventDefault();
                onSave();
              }}
            >
              <label className="field-label">
                Preferred AI route
                <span className="settings-select">
                  <select
                    value={models.provider}
                    onChange={(event) =>
                      setModels({ ...models, provider: event.target.value })
                    }
                  >
                    <option value="auto">
                      Auto · choose the best available route
                    </option>
                    <option value="ollama">Ollama · local only</option>
                    <option value="gemini">Gemini · cloud only</option>
                    <option value="sarvam">Sarvam · cloud only</option>
                    <option value="openrouter">OpenRouter · cloud only</option>
                    <option value="groq">Groq · cloud only</option>
                  </select>
                  <ChevronDown size={14} />
                </span>
              </label>
              <div className="settings-provider-status">
                <span className={models.gemini_configured ? "ready" : ""}>
                  <Cloud size={14} /> Gemini{" "}
                  {models.gemini_configured ? "ready" : "not configured"}
                </span>
                <span className="ready">
                  <Cpu size={14} /> Ollama local route
                </span>
                <span className={models.sarvam_configured ? "ready" : ""}>
                  <Cloud size={14} /> Sarvam{" "}
                  {models.sarvam_configured ? "ready" : "not configured"}
                </span>
                <span className={models.openrouter_configured ? "ready" : ""}>
                  <Cloud size={14} /> OpenRouter{" "}
                  {models.openrouter_configured ? "ready" : "not configured"}
                </span>
                <span className={models.groq_configured ? "ready" : ""}>
                  <Cloud size={14} /> Groq{" "}
                  {models.groq_configured ? "ready" : "not configured"}
                </span>
              </div>
              {onboarding && (
                <div className="ollama-onboarding">
                  <div>
                    <Cpu size={19} />
                    <span>
                      <strong>Local AI comes first</strong>
                      <small>
                        {onboarding.memory_gb
                          ? `${onboarding.memory_gb} GB RAM detected · `
                          : ""}
                        {onboarding.recommended_model} is the recommended
                        starting model.
                      </small>
                    </span>
                  </div>
                  <code>{onboarding.pull_command}</code>
                  <button
                    type="button"
                    className="icon-button"
                    title="Copy pull command"
                    onClick={() =>
                      void navigator.clipboard.writeText(
                        onboarding.pull_command,
                      )
                    }
                  >
                    <Copy size={15} />
                  </button>
                  <span
                    className={onboarding.ollama_online ? "ready" : "offline"}
                  >
                    {onboarding.ollama_online
                      ? "Ollama is running"
                      : "Start Ollama, then run this command"}
                  </span>
                </div>
              )}
              <details className="settings-advanced provider-keys">
                <summary>
                  <KeyRound size={16} /> Connect your own cloud AI{" "}
                  <ChevronDown size={14} />
                </summary>
                <p>
                  Keys are encrypted on the server and belong only to this
                  account. Leave a key blank to keep the saved one.
                </p>
                <div className="cloud-key-grid">
                  {clouds.map((item) => (
                    <div className="cloud-key" key={item.id}>
                      <label className="field-label">
                        {item.label} API key
                        <input
                          type="password"
                          autoComplete="off"
                          value={models.api_keys?.[item.id] || ""}
                          placeholder={
                            models[`${item.id}_configured`]
                              ? "Saved securely · enter to replace"
                              : item.placeholder
                          }
                          onChange={(event) =>
                            updateKey(item.id, event.target.value)
                          }
                        />
                      </label>
                      <label className="field-label">
                        Model
                        <input
                          value={models.cloud_models?.[item.id] || ""}
                          onChange={(event) =>
                            updateCloudModel(item.id, event.target.value)
                          }
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </details>
              <details className="settings-advanced">
                <summary>
                  <Settings2 size={16} /> Advanced model assignments{" "}
                  <ChevronDown size={14} />
                </summary>
                <p>
                  Change these only when the replacement model is already
                  available to its provider.
                </p>
                <div className="model-fields">
                  {Object.entries(models.models).map(([task, model]) => (
                    <label className="field-label" key={task}>
                      <span>{task}</span>
                      <input
                        value={String(model)}
                        onChange={(event) =>
                          setModels({
                            ...models,
                            models: {
                              ...models.models,
                              [task]: event.target.value,
                            },
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
                {models.embedding_backend && (
                  <div className="settings-inline-note">
                    <Database size={15} />
                    <span>
                      Embeddings:{" "}
                      <strong>{models.embedding_backend.model}</strong>. A model
                      change creates a separate compatible index before
                      switching.
                    </span>
                  </div>
                )}
              </details>
              <button className="button primary" disabled={!!busy}>
                <Check size={16} /> Save AI route
              </button>
            </form>
          )}
        </section>

        <section className="settings-card">
          <div className="settings-card-icon sand">
            <Music2 size={21} />
          </div>
          <div className="settings-card-copy">
            <span className="eyebrow">SOUND DECK</span>
            <h3>Adventure sounds</h3>
            <p>
              Short original cues after answers and achievements. Nothing
              autoplays when a page opens.
            </p>
          </div>
          <button
            className="settings-toggle-row"
            role="switch"
            aria-checked={sound}
            onClick={() => setSound(!sound)}
          >
            <span>
              {sound ? "Sound is on" : "Sound is muted"}
              <small>
                {sound
                  ? "You will hear interaction cues"
                  : "Your study sessions stay silent"}
              </small>
            </span>
            <i className={sound ? "on" : ""}>
              <b />
            </i>
          </button>
        </section>

        <section className="settings-card">
          <div className="settings-card-icon blue">
            <ShieldCheck size={21} />
          </div>
          <div className="settings-card-copy">
            <span className="eyebrow">PRIVACY & STORAGE</span>
            <h3>Your ship, your data</h3>
            <p>
              Courses, progress, notes, and uploaded files live in{" "}
              <code>backend/data</code> on this laptop.
            </p>
          </div>
          <div className="privacy-points">
            <span>
              <LockKeyhole size={15} /> API keys are encrypted per account
            </span>
            <span>
              <HardDrive size={15} /> Local-first SQLite and vector storage
            </span>
            <span>
              <Cloud size={15} /> Cloud AI only when Ollama is unavailable or
              selected
            </span>
          </div>
        </section>

        <section className="settings-card settings-share-card">
          <div className="settings-card-icon rose">
            <Share2 size={21} />
          </div>
          <div className="settings-card-copy">
            <span className="eyebrow">INVITE A CREWMATE</span>
            <h3>Share Intellora safely</h3>
            <p>
              Create a clean copy without your API keys, private uploads, notes,
              or learning history.
            </p>
          </div>
          <button className="button outline" onClick={onShare}>
            <Share2 size={16} /> Friend setup guide
          </button>
        </section>
      </div>
    </div>
  );
}
