import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Copy, Download, Film, ImageUp, Sparkles, Wand2 } from 'lucide-react';
import { SPECULATIVE_STATUSES, VERIFICATION_LABELS, type VerificationStatus } from '@pgi/shared';
import { formatDateTime } from '../../lib/format.ts';
import { useAuth } from '../AdminApp.tsx';
import { api, useApiMutation, useApiQuery } from '../api.ts';
import { Feedback, Pill } from '../form.tsx';
import { FORMATS, canvasToBlob, downloadBlob, drawArt, renderVideo, videoSupported, type ArtInput, type FormatKey, type Scene } from '../studio-render.ts';
import { uploadMedia } from './Media.tsx';

interface Script {
  hook: string;
  narration: string;
  scenes: Scene[];
}
interface PackageData {
  generator: 'ai' | 'template';
  titles: string[];
  socialSummary: string;
  hook: string;
  scripts: { s15: Script; s30: Script; s60: Script };
  coverSuggestion: { headline: string; kicker: string; visualIdea: string };
  captions: { instagram: string; tiktok: string; youtube: string };
  channelCta: string;
  references: { label: string; url: string }[];
  verificationStatus: VerificationStatus;
  speculativeNotice: string | null;
}
interface PackageRow {
  id: number;
  articleId: number;
  title: string;
  createdAt: string;
  data: PackageData;
}
interface ArticleLite {
  id: number;
  slug: string;
  title: string;
  verificationStatus: VerificationStatus;
  approvalStatus: string;
  sources: { publisher: string }[];
}

const STATUS_COLORS: Record<VerificationStatus, string> = {
  confirmed: '#3ddc84',
  reported: '#4cc3ff',
  rumor: '#ffc53d',
  theory: '#b49cff',
  debunked: '#ff6b6b',
  outdated: '#94a3b8',
  in_review: '#ff9f43',
};

function CopyBox({ label, text }: { label: string; text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div>
      <div className="row" style={{ marginBottom: 4 }}>
        <strong className="small">{label}</strong>
        <span className="spacer" />
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => {
            void navigator.clipboard.writeText(text).then(() => {
              setOk(true);
              setTimeout(() => setOk(false), 1500);
            });
          }}
        >
          <Copy size={13} aria-hidden="true" /> {ok ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <div className="copy-box">{text}</div>
    </div>
  );
}

function Picker() {
  const navigate = useNavigate();
  const q = useApiQuery<{ items: { id: number; title: string; approvalStatus: string; verificationStatus: VerificationStatus; updatedAt: string }[] }>(['articles', 'studio'], '/articles?pageSize=100');
  const items = q.data?.items.filter((a) => a.approvalStatus === 'approved' || a.approvalStatus === 'published') ?? [];
  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Estúdio de conteúdo</h1>
          <p>Transforme um artigo aprovado em pacote para redes sociais: títulos, roteiros de 15, 30 e 60 segundos, legendas, artes e vídeo curto.</p>
        </div>
      </div>
      <Feedback error={q.error} />
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Artigo aprovado/publicado</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td>{a.title}</td>
                <td>{VERIFICATION_LABELS[a.verificationStatus]}</td>
                <td>
                  <div className="actions">
                    <button type="button" className="btn btn--primary btn--sm" onClick={() => navigate(String(a.id))}>
                      <Film size={14} aria-hidden="true" /> Abrir no estúdio
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  Nenhum artigo aprovado. O estúdio só trabalha com conteúdo que passou por revisão humana.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function StudioPage() {
  const { id } = useParams();
  if (!id) return <Picker />;
  return <StudioEditor articleId={Number(id)} />;
}

function StudioEditor({ articleId }: { articleId: number }) {
  const { can } = useAuth();
  const article = useApiQuery<ArticleLite>(['article', String(articleId)], `/articles/${articleId}`);
  const settings = useApiQuery<Record<string, unknown>>(['settings'], '/settings');
  const packages = useApiQuery<PackageRow[]>(['packages', articleId], `/studio/packages?articleId=${articleId}`);
  const generate = useApiMutation(() => api<PackageRow>(`/studio/articles/${articleId}/package`, { method: 'POST', json: {} }), [['packages', articleId]]);
  const [selected, setSelected] = useState<number | null>(null);
  const pkg = useMemo(() => packages.data?.find((p) => p.id === selected) ?? packages.data?.[0] ?? null, [packages.data, selected]);
  const [headline, setHeadline] = useState('');
  const [script, setScript] = useState<'s15' | 's30' | 's60'>('s30');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const canvases = useRef<Record<string, HTMLCanvasElement | null>>({});
  const videoCanvas = useRef<HTMLCanvasElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    if (pkg) setHeadline(pkg.data.coverSuggestion.headline);
  }, [pkg]);

  const a = article.data;
  const siteName = typeof settings.data?.siteName === 'string' ? settings.data.siteName : 'Project GTA IV';
  const artInput: ArtInput | null =
    a && pkg
      ? {
          headline: headline || a.title,
          kicker: pkg.data.coverSuggestion.kicker,
          statusLabel: VERIFICATION_LABELS[a.verificationStatus],
          statusColor: STATUS_COLORS[a.verificationStatus],
          siteName,
          sourceLine: a.sources.length ? `Fonte: ${a.sources.map((s) => s.publisher).slice(0, 2).join(', ')}` : 'Análise da redação',
          seed: a.slug,
          speculative: SPECULATIVE_STATUSES.has(a.verificationStatus),
        }
      : null;

  useEffect(() => {
    if (!artInput) return;
    for (const f of FORMATS) {
      const c = canvases.current[f.key];
      if (c) void drawArt(c, f, artInput).catch((e) => setErr(e));
    }
  }, [artInput?.headline, artInput?.seed, artInput?.statusLabel, artInput?.siteName, artInput?.kicker]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportArt = async (key: FormatKey, upload: boolean) => {
    const c = canvases.current[key];
    if (!c || !a) return;
    setErr(null);
    setMsg(null);
    try {
      const blob = await canvasToBlob(c);
      const name = `${a.slug}-${key}.png`;
      if (upload) {
        await uploadMedia(blob, { title: `Arte ${key} — ${a.title}`.slice(0, 160), alt: headline, license: 'original', articleId: a.id }, name);
        setMsg(`Arte ${key} salva na biblioteca de mídia.`);
      } else downloadBlob(blob, name);
    } catch (e) {
      setErr(e);
    }
  };

  const makeVideo = async () => {
    if (!pkg || !artInput || !videoCanvas.current) return;
    setErr(null);
    setVideoUrl(null);
    setProgress(0);
    try {
      const blob = await renderVideo(videoCanvas.current, pkg.data.scripts[script].scenes, artInput, setProgress);
      setVideoBlob(blob);
      setVideoUrl(URL.createObjectURL(blob));
    } catch (e) {
      setErr(e);
    } finally {
      setProgress(null);
    }
  };

  if (article.isLoading) return <p role="status">Carregando…</p>;
  if (article.error || !a) return <Feedback error={article.error} />;
  if (a.approvalStatus !== 'approved' && a.approvalStatus !== 'published') {
    return (
      <div className="alert alert--warn">
        Este artigo ainda não foi aprovado. <Link to={`../artigos/${a.id}`}>Voltar ao editor</Link>.
      </div>
    );
  }

  const s = pkg?.data.scripts[script];
  return (
    <>
      <div className="admin-head">
        <div>
          <div className="eyebrow">Estúdio de conteúdo</div>
          <h1 style={{ marginTop: 4 }}>{a.title}</h1>
          <p className="row">
            <Pill tone={a.verificationStatus === 'confirmed' ? 'ok' : 'warn'}>{VERIFICATION_LABELS[a.verificationStatus]}</Pill>
            <Link to={`../artigos/${a.id}`} className="small">
              Abrir artigo
            </Link>
          </p>
        </div>
        {can('media:write') && (
          <button type="button" className="btn btn--primary" disabled={generate.isPending} onClick={() => generate.mutate(undefined, { onSuccess: (r) => setSelected(r.id) })}>
            <Wand2 size={16} aria-hidden="true" /> {generate.isPending ? 'Gerando…' : pkg ? 'Gerar nova versão' : 'Gerar pacote'}
          </button>
        )}
      </div>
      <Feedback error={generate.error ?? packages.error ?? err} success={msg} />

      {!pkg ? (
        <div className="state">
          <Sparkles size={32} aria-hidden="true" />
          <h3>Nenhum pacote gerado ainda</h3>
          <p>Gere títulos, roteiros, legendas e cenas a partir do texto aprovado.</p>
        </div>
      ) : (
        <>
          {packages.data && packages.data.length > 1 && (
            <div className="filters">
              {packages.data.map((p) => (
                <button key={p.id} type="button" className="chip" aria-pressed={p.id === pkg.id} onClick={() => setSelected(p.id)}>
                  {formatDateTime(p.createdAt)} · {p.data.generator === 'ai' ? 'IA' : 'modelo'}
                </button>
              ))}
            </div>
          )}
          {pkg.data.generator === 'template' && (
            <div className="alert alert--info small">
              Pacote gerado pelo modelo de texto, sem IA (chave não configurada ou limite diário atingido). Revise e adapte os textos antes de publicar.
            </div>
          )}
          {pkg.data.speculativeNotice && <div className="alert alert--warn">{pkg.data.speculativeNotice} Mantenha esse aviso em todas as peças.</div>}

          <div className="split">
            <section className="panel stack" aria-label="Textos">
              <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Textos</h2>
              <div>
                <strong className="small">Sugestões de título</strong>
                <ol className="small" style={{ margin: '6px 0 0', paddingLeft: 20 }}>
                  {pkg.data.titles.map((t, i) => (
                    <li key={i}>
                      {t}{' '}
                      <button type="button" className="btn btn--ghost btn--sm" style={{ padding: '1px 8px' }} onClick={() => setHeadline(t)}>
                        usar na arte
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
              <CopyBox label="Resumo para redes" text={pkg.data.socialSummary} />
              <CopyBox label="Gancho inicial" text={pkg.data.hook} />
              <CopyBox label="Legenda — Instagram" text={pkg.data.captions.instagram} />
              <CopyBox label="Legenda — TikTok" text={pkg.data.captions.tiktok} />
              <CopyBox label="Descrição — YouTube" text={pkg.data.captions.youtube} />
              <CopyBox label="Chamada para Telegram/WhatsApp" text={pkg.data.channelCta} />
              <div>
                <strong className="small">Referências</strong>
                <ul className="small" style={{ margin: '6px 0 0', paddingLeft: 20 }}>
                  {pkg.data.references.map((r) => (
                    <li key={r.url}>
                      <a href={r.url} target="_blank" rel="noopener noreferrer">
                        {r.label}
                      </a>
                    </li>
                  ))}
                  {pkg.data.references.length === 0 && <li>Sem fontes externas (análise da redação).</li>}
                </ul>
              </div>
            </section>

            <section className="panel stack" aria-label="Roteiro de vídeo">
              <div className="row">
                <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Roteiro de vídeo</h2>
                <span className="spacer" />
                {(['s15', 's30', 's60'] as const).map((k) => (
                  <button key={k} type="button" className="chip" aria-pressed={script === k} onClick={() => setScript(k)}>
                    {k.slice(1)}s
                  </button>
                ))}
              </div>
              {s && (
                <>
                  <CopyBox label="Texto para narração" text={s.narration} />
                  <div className="scene-list">
                    {s.scenes.map((sc, i) => (
                      <div key={i} className="scene">
                        <b>{sc.seconds}s</b>
                        <div>
                          <div>{sc.caption}</div>
                          <div className="muted small">{sc.visual}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="small muted">
                    Sugestão de capa: {pkg.data.coverSuggestion.visualIdea}. Use apenas ativos com permissão de uso; não use trailers nem gameplay de terceiros.
                  </p>
                  {videoSupported() ? (
                    <>
                      <button type="button" className="btn btn--cyan" disabled={progress !== null} onClick={() => void makeVideo()}>
                        <Film size={16} aria-hidden="true" /> {progress !== null ? `Renderizando… ${Math.round(progress * 100)}%` : `Renderizar vídeo 9:16 (${s.scenes.reduce((x, y) => x + y.seconds, 0)}s)`}
                      </button>
                      <canvas ref={videoCanvas} className="studio-canvas" style={{ display: progress !== null ? 'block' : 'none', maxWidth: 270 }} aria-label="Prévia da renderização" />
                      {videoUrl && (
                        <div className="stack">
                          <video src={videoUrl} controls style={{ maxWidth: 270, borderRadius: 10 }} />
                          <div className="row">
                            <button type="button" className="btn btn--ghost btn--sm" onClick={() => videoBlob && downloadBlob(videoBlob, `${a.slug}-${script}.webm`)}>
                              <Download size={14} aria-hidden="true" /> Baixar WebM
                            </button>
                            {can('media:write') && (
                              <button
                                type="button"
                                className="btn btn--ghost btn--sm"
                                onClick={() =>
                                  videoBlob &&
                                  void uploadMedia(videoBlob, { title: `Vídeo ${script.slice(1)}s — ${a.title}`.slice(0, 160), license: 'original', articleId: a.id }, `${a.slug}-${script}.webm`)
                                    .then(() => setMsg('Vídeo salvo na biblioteca.'))
                                    .catch(setErr)
                                }
                              >
                                <ImageUp size={14} aria-hidden="true" /> Salvar na biblioteca
                              </button>
                            )}
                          </div>
                          <p className="small muted">O vídeo não inclui narração nem música. Grave a narração com o texto acima e use apenas trilhas licenciadas.</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="small muted">Este navegador não suporta gravação de vídeo (MediaRecorder). Use Chrome, Edge ou Firefox no computador.</p>
                  )}
                </>
              )}
            </section>
          </div>

          <section className="panel" style={{ marginTop: 16 }} aria-label="Artes">
            <div className="row" style={{ marginBottom: 12 }}>
              <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Artes originais</h2>
              <span className="spacer" />
              <label htmlFor="art-headline" className="small">
                Manchete da arte
              </label>
              <input id="art-headline" className="input" style={{ maxWidth: 420 }} value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={120} />
            </div>
            <div className="studio-formats">
              {FORMATS.map((f) => (
                <figure key={f.key} style={{ margin: 0 }}>
                  <canvas ref={(el) => void (canvases.current[f.key] = el)} className="studio-canvas" aria-label={`Prévia ${f.label}`} />
                  <figcaption className="small" style={{ marginTop: 6 }}>
                    <strong>{f.label}</strong> · {f.w}×{f.h}
                    <div className="row" style={{ marginTop: 6 }}>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => void exportArt(f.key, false)}>
                        <Download size={13} aria-hidden="true" /> PNG
                      </button>
                      {can('media:write') && (
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => void exportArt(f.key, true)}>
                          <ImageUp size={13} aria-hidden="true" /> Biblioteca
                        </button>
                      )}
                    </div>
                  </figcaption>
                </figure>
              ))}
            </div>
            <p className="small muted" style={{ marginTop: 12 }}>
              As artes usam a ilustração original do portal e não representam material oficial do jogo.
            </p>
          </section>
        </>
      )}
    </>
  );
}
