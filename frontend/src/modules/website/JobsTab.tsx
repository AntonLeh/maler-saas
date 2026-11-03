import { useEffect, useState } from "react";
import type { Website, WebsiteApplication, WebsiteJob } from "./types";
import { EMPLOYMENT_OPTIONS, JOB_TEMPLATES, emptyJob, jobSlug, publicUrl, previewUrl } from "./types";
import * as api from "./api";

const lines = (v: string) =>
  v
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 12);
const fmtDate = (iso: string) => new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const STATUS_LABEL: Record<WebsiteApplication["status"], string> = { neu: "Neu", kontaktiert: "Kontaktiert", erledigt: "Erledigt" };

/** Eine Stelle bearbeiten (Listen als „eine Zeile = ein Punkt“) */
function JobEditor({ job, onChange, onDone }: { job: WebsiteJob; onChange: (j: WebsiteJob) => void; onDone: () => void }) {
  const [tasks, setTasks] = useState(job.tasks.join("\n"));
  const [profile, setProfile] = useState(job.profile.join("\n"));
  const [benefits, setBenefits] = useState(job.benefits.join("\n"));
  const set = (patch: Partial<WebsiteJob>) => onChange({ ...job, ...patch });
  const salary = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.round(Number(v.replace(",", ".")) * 100) / 100) || null);

  return (
    <div className="ws-job-edit">
      <div className="ws-job-grid">
        <label className="tk-field ws-span2">
          <span>Stellenbezeichnung *</span>
          <input value={job.title} maxLength={90} onChange={(e) => set({ title: e.target.value })} placeholder="z. B. Maler- und Lackierer/in (m/w/d)" />
        </label>
        <label className="tk-field">
          <span>Art</span>
          <select value={job.employment} onChange={(e) => set({ employment: e.target.value })}>
            {EMPLOYMENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="tk-field">
          <span>Arbeitsort</span>
          <input value={job.location} maxLength={60} onChange={(e) => set({ location: e.target.value })} />
        </label>
        <label className="tk-field">
          <span>Beginn</span>
          <input value={job.start} maxLength={40} onChange={(e) => set({ start: e.target.value })} placeholder="ab sofort" />
        </label>
        <div className="tk-field">
          <span>Gehalt (optional)</span>
          <div className="ws-row ws-salary">
            <input inputMode="decimal" aria-label="Gehalt von" placeholder="von" value={job.salary_min ?? ""} onChange={(e) => set({ salary_min: salary(e.target.value) })} />
            <span>–</span>
            <input inputMode="decimal" aria-label="Gehalt bis" placeholder="bis" value={job.salary_max ?? ""} onChange={(e) => set({ salary_max: salary(e.target.value) })} />
            <select aria-label="Gehalt pro" value={job.salary_unit} onChange={(e) => set({ salary_unit: e.target.value as WebsiteJob["salary_unit"] })}>
              <option value="HOUR">€ / Stunde</option>
              <option value="MONTH">€ / Monat</option>
            </select>
          </div>
        </div>
      </div>
      <label className="tk-field">
        <span>Beschreibung</span>
        <textarea rows={4} maxLength={2000} value={job.text} onChange={(e) => set({ text: e.target.value })} placeholder="Ein paar Sätze zur Stelle und zu Ihrem Betrieb" />
      </label>
      <div className="ws-job-grid three">
        <label className="tk-field">
          <span>Ihre Aufgaben</span>
          <textarea rows={5} value={tasks} onChange={(e) => (setTasks(e.target.value), set({ tasks: lines(e.target.value) }))} />
        </label>
        <label className="tk-field">
          <span>Ihr Profil</span>
          <textarea rows={5} value={profile} onChange={(e) => (setProfile(e.target.value), set({ profile: lines(e.target.value) }))} />
        </label>
        <label className="tk-field">
          <span>Wir bieten</span>
          <textarea rows={5} value={benefits} onChange={(e) => (setBenefits(e.target.value), set({ benefits: lines(e.target.value) }))} />
        </label>
      </div>
      <small className="tk-muted">Bei den drei Listen gilt: eine Zeile = ein Punkt. Angaben zum Gehalt machen Anzeigen deutlich erfolgreicher.</small>
      <div className="ws-row ws-job-done">
        <button type="button" className="btn btn-secondary btn-small" onClick={onDone}>
          Fertig
        </button>
      </div>
    </div>
  );
}

export default function JobsTab({
  tenantId,
  website,
  city,
  saving,
  onSave,
  onError,
  onNewCount,
}: {
  tenantId: number;
  website: Website;
  city?: string | null;
  saving: boolean;
  onSave: (values: Partial<Website>) => void;
  onError: (msg: string) => void;
  onNewCount: (n: number) => void;
}) {
  const [jobs, setJobs] = useState<WebsiteJob[]>(() => (website.jobs ?? []).map((j) => ({ ...emptyJob(city), ...j })));
  const [open, setOpen] = useState<string | null>(null);
  const [apps, setApps] = useState<WebsiteApplication[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [error, setError] = useState("");
  const supported = website.jobs !== undefined;
  const dirty = JSON.stringify(jobs) !== JSON.stringify((website.jobs ?? []).map((j) => ({ ...emptyJob(city), ...j })));
  const pageUrl = (slug: string) => (website.published ? `${publicUrl(website)}/${slug}` : previewUrl(website).replace("?", `/${slug}?`));

  const reload = async () => {
    try {
      const list = await api.loadApplications(tenantId);
      setApps(list);
      onNewCount(list.filter((a) => a.status === "neu").length);
    } catch (e) {
      setApps([]);
      if (supported) onError((e as Error).message);
    }
  };
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- einmal beim Öffnen
  }, [tenantId]);

  if (!supported) {
    return (
      <div className="tk-notice tk-notice-info">
        Für „Wir stellen ein“ fehlt noch ein Datenbank-Update (20261103230000_website_stellen.sql). Danach erscheint hier die Einstellung.
      </div>
    );
  }

  const update = (j: WebsiteJob) => setJobs((list) => list.map((x) => (x.id === j.id ? j : x)));
  const add = (tpl?: (typeof JOB_TEMPLATES)[number]) => {
    if (jobs.length >= 10) return setError("Höchstens 10 Stellen möglich.");
    const j = { ...emptyJob(city), ...(tpl?.job ?? {}) };
    setJobs((list) => [...list, j]);
    setOpen(j.id);
  };
  const remove = (id: string) => window.confirm("Diese Stelle löschen?") && setJobs((list) => list.filter((x) => x.id !== id));
  const save = () => {
    setError("");
    const bad = jobs.find((j) => !j.title.trim());
    if (bad) {
      setOpen(bad.id);
      return setError("Bitte bei jeder Stelle eine Bezeichnung eintragen.");
    }
    const wrong = jobs.find((j) => j.salary_min && j.salary_max && j.salary_max < j.salary_min);
    if (wrong) {
      setOpen(wrong.id);
      return setError("Beim Gehalt muss „bis“ größer als „von“ sein.");
    }
    setOpen(null);
    onSave({ jobs: jobs.map((j) => ({ ...j, title: j.title.trim(), text: j.text.trim() })) });
  };

  const act = async (id: number, fn: () => Promise<void>) => {
    setBusyId(id);
    try {
      await fn();
      await reload();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };
  const openCv = async (a: WebsiteApplication) => {
    setBusyId(a.id);
    try {
      const { url, name } = await api.loadApplicationCv(tenantId, a.id);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.target = "_blank";
      link.rel = "noopener";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const visibleApps = (apps ?? []).filter((a) => showDone || a.status !== "erledigt");
  const doneCount = (apps ?? []).filter((a) => a.status === "erledigt").length;

  return (
    <div className="ws-stack">
      <section className="ws-panel">
        <h3>Wir stellen ein</h3>
        <p className="tk-muted ws-dom-intro">
          Offene Stellen erscheinen auf Ihrer Website unter „Karriere“ und auf der Startseite. Bewerber schicken ihre Bewerbung direkt an Sie – ohne
          Anschreiben, Lebenslauf optional. Die Stellen werden so ausgezeichnet, dass Google sie in der Jobsuche anzeigen kann.
        </p>

        {jobs.length === 0 && <p className="tk-muted">Noch keine Stelle angelegt. Am schnellsten geht es mit einer Vorlage:</p>}
        <ul className="ws-job-list">
          {jobs.map((j) => (
            <li key={j.id} className={j.active ? "" : "off"}>
              <div className="ws-job-row">
                <div>
                  <strong>{j.title || "Neue Stelle"}</strong>
                  <span className="tk-muted">
                    {" "}
                    · {EMPLOYMENT_OPTIONS.find((o) => o.value === j.employment)?.label}
                    {j.location ? ` · ${j.location}` : ""}
                  </span>
                </div>
                <div className="ws-row">
                  <label className="ws-check-inline">
                    <input type="checkbox" checked={j.active} onChange={(e) => update({ ...j, active: e.target.checked })} /> sichtbar
                  </label>
                  {j.title && !dirty && j.active && (
                    <a className="ws-link" href={pageUrl(jobSlug(j))} target="_blank" rel="noreferrer">
                      Ansehen ↗
                    </a>
                  )}
                  <button type="button" className="ws-link" onClick={() => setOpen(open === j.id ? null : j.id)}>
                    {open === j.id ? "Zuklappen" : "Bearbeiten"}
                  </button>
                  <button type="button" className="ws-link ws-danger" onClick={() => remove(j.id)}>
                    Löschen
                  </button>
                </div>
              </div>
              {open === j.id && <JobEditor job={j} onChange={update} onDone={() => setOpen(null)} />}
            </li>
          ))}
        </ul>

        {jobs.length < 10 && (
          <div className="ws-row ws-job-add">
            <span className="tk-muted">Neue Stelle:</span>
            {JOB_TEMPLATES.map((t) => (
              <button key={t.label} type="button" className="ws-chip" onClick={() => add(t)}>
                + {t.label}
              </button>
            ))}
            <button type="button" className="ws-chip" onClick={() => add()}>
              + Leer
            </button>
          </div>
        )}
        {error && <div className="tk-notice tk-notice-error">{error}</div>}
        <div className="ws-row ws-bk-save">
          {dirty && <span className="tk-muted">Ungespeicherte Änderungen</span>}
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving || !dirty}>
            {saving ? "Speichert …" : "Stellen speichern"}
          </button>
        </div>
      </section>

      <section className="ws-panel">
        <div className="ws-row ws-bk-head">
          <h3>Bewerbungen</h3>
          {doneCount > 0 && (
            <label className="ws-check-inline">
              <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Erledigte anzeigen ({doneCount})
            </label>
          )}
        </div>
        <p className="tk-muted">Bewerbungen werden nach 6 Monaten automatisch gelöscht. Das schreibt der Datenschutz so vor.</p>
        {apps === null ? (
          <p className="tk-muted">Wird geladen …</p>
        ) : visibleApps.length === 0 ? (
          <p className="tk-muted">Noch keine Bewerbungen.</p>
        ) : (
          <ul className="ws-app-list">
            {visibleApps.map((a) => (
              <li key={a.id} className={`ws-app ${a.status}`}>
                <div className="ws-app-head">
                  <div>
                    <strong>{a.name}</strong> <span className="tk-muted">· {a.job_title}</span>
                    <div className="tk-muted ws-app-date">{fmtDate(a.created_at)}</div>
                  </div>
                  <span className={`ws-app-badge ${a.status}`}>{STATUS_LABEL[a.status]}</span>
                </div>
                <dl className="ws-app-facts">
                  {a.phone && (
                    <>
                      <dt>Telefon</dt>
                      <dd>
                        <a href={`tel:${a.phone.replace(/[^\d+]/g, "")}`}>{a.phone}</a>
                      </dd>
                    </>
                  )}
                  {a.email && (
                    <>
                      <dt>E-Mail</dt>
                      <dd>
                        <a href={`mailto:${a.email}`}>{a.email}</a>
                      </dd>
                    </>
                  )}
                  {a.experience && (
                    <>
                      <dt>Erfahrung</dt>
                      <dd>{a.experience}</dd>
                    </>
                  )}
                  {a.available_from && (
                    <>
                      <dt>Verfügbar ab</dt>
                      <dd>{a.available_from}</dd>
                    </>
                  )}
                  {a.driving_license && (
                    <>
                      <dt>Führerschein</dt>
                      <dd>Klasse B</dd>
                    </>
                  )}
                </dl>
                {a.message && <p className="ws-app-msg">{a.message}</p>}
                <div className="ws-row">
                  {a.cv_mime && (
                    <button type="button" className="btn btn-secondary btn-small" disabled={busyId === a.id} onClick={() => openCv(a)}>
                      📄 Lebenslauf öffnen
                    </button>
                  )}
                  {a.status !== "kontaktiert" && a.status !== "erledigt" && (
                    <button type="button" className="ws-link" disabled={busyId === a.id} onClick={() => act(a.id, () => api.setApplicationStatus(tenantId, a.id, "kontaktiert"))}>
                      Als kontaktiert markieren
                    </button>
                  )}
                  {a.status !== "erledigt" ? (
                    <button type="button" className="ws-link" disabled={busyId === a.id} onClick={() => act(a.id, () => api.setApplicationStatus(tenantId, a.id, "erledigt"))}>
                      Erledigt
                    </button>
                  ) : (
                    <button type="button" className="ws-link" disabled={busyId === a.id} onClick={() => act(a.id, () => api.setApplicationStatus(tenantId, a.id, "neu"))}>
                      Wieder öffnen
                    </button>
                  )}
                  <button
                    type="button"
                    className="ws-link ws-danger"
                    disabled={busyId === a.id}
                    onClick={() => window.confirm("Bewerbung endgültig löschen?") && act(a.id, () => api.deleteApplication(tenantId, a.id))}
                  >
                    Löschen
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
