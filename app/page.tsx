'use client';

import { useRef, useState } from 'react';

type Mode = 'hd' | 'ultra' | 'uhd ai';

interface Result {
  url: string;
  width: number;
  height: number;
  ratio: string;
  originalWidth: number;
  originalHeight: number;
  size: string;
  mode: string;
}

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('uhd ai');
  const [keepSize, setKeepSize] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    if (!f.type.startsWith('image/')) {
      setError('File harus berupa gambar');
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setError(null);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  async function handleSubmit() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const form = new FormData();
      form.append('image', file);
      form.append('mode', mode);
      form.append('keepSize', String(keepSize));

      const res = await fetch('/api/upscale', { method: 'POST', body: form });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal memproses');
      }
      setResult(data.data);
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
  }

  return (
    <div className="container">
      <header className="header">
        <div className="logo">Clarif<span>.</span></div>
        <div className="header-right">
          <div className="badge forum">Hanzz Forum Grupp</div>
          <div className="badge">AI Upscale</div>
        </div>
      </header>

      <main className="bento">
        {!file && !result && (
          <div
            className={`card upload-card ${dragging ? 'dragging' : ''}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <div className="upload-icon">↑</div>
            <div className="upload-title">Drop gambar di sini</div>
            <div className="upload-sub">atau klik untuk pilih file</div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>
        )}

        {file && !result && (
          <>
            <div className="card preview-card">
              {preview && <img src={preview} alt="preview" className="preview-img" />}
              <div className="preview-name">{file.name}</div>
            </div>

            <div className="card settings-card">
              <div>
                <label className="field-label">Mode</label>
                <div className="mode-group">
                  {(['hd', 'ultra', 'uhd ai'] as Mode[]).map((m) => (
                    <button
                      key={m}
                      className={`mode-btn ${mode === m ? 'active' : ''}`}
                      onClick={() => setMode(m)}
                    >
                      {m.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="toggle-row">
                <span>Pertahankan ukuran asli</span>
                <button
                  className={`switch ${keepSize ? 'on' : ''}`}
                  onClick={() => setKeepSize(!keepSize)}
                />
              </div>

              <button
                onClick={reset}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--muted)',
                  fontSize: 13,
                  cursor: 'pointer',
                  textAlign: 'left',
                  padding: 0
                }}
              >
                ← Ganti gambar
              </button>
            </div>

            <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
              {loading ? <><span className="spinner" />Memproses...</> : 'Upscale'}
            </button>
          </>
        )}

        {error && <div className="error-box">{error}</div>}

        {result && (
          <div className="card result-card">
            <img src={result.url} alt="result" className="result-img" />

            <div className="result-meta">
              <div className="meta-item">
                <div className="meta-label">Mode</div>
                <div className="meta-value">{result.mode.toUpperCase()}</div>
              </div>
              <div className="meta-item">
                <div className="meta-label">Dimensi</div>
                <div className="meta-value">{result.width} × {result.height}</div>
              </div>
              <div className="meta-item">
                <div className="meta-label">Rasio</div>
                <div className="meta-value">{result.ratio}</div>
              </div>
              <div className="meta-item">
                <div className="meta-label">Ukuran</div>
                <div className="meta-value">{result.size || '—'}</div>
              </div>
            </div>

            <a href={result.url} download className="btn-download">Download</a>
            <button className="btn-download" onClick={reset}>Upscale lagi</button>
          </div>
        )}

        <footer className="footer">
          <span>Clarif</span>
          <span>·</span>
          <span className="footer-brand">Hanzz Forum Grupp</span>
        </footer>
      </main>
    </div>
  );
}