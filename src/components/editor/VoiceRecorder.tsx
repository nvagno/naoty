"use client";

import type { Editor } from "@tiptap/react";
import { Selection } from "@tiptap/pm/state";
import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Pause, Play, RotateCcw, Square } from "lucide-react";
import { Modal, ModalHeader } from "../ui";
import { getAlbertSettings, transcribeAttachment, uploadAttachment } from "@/lib/client/api";
import { audioExtension, formatDuration, recordingTitle, transcriptParagraphs } from "@/lib/audio";
import type { AttachmentInfo } from "@/lib/types";

type Props = {
  editor: Editor;
  noteId: string;
  open: boolean;
  onClose: () => void;
  onAttachment: (a: AttachmentInfo) => void;
  onError: (message: string) => void;
};

/** Enregistrement d'un vocal en direct, inséré dans la note avec sa transcription (Albert). */
export function VoiceRecorder(props: Props) {
  // Un enregistrement en cours ou terminé ne doit pas se perdre sur un Échap ou un clic à côté.
  const guard = useRef<() => boolean>(() => true);
  const setGuard = useCallback((fn: () => boolean) => {
    guard.current = fn;
  }, []);
  const close = () => guard.current() && props.onClose();
  return (
    <Modal open={props.open} onClose={close} label="Enregistrer un vocal" width="max-w-md">
      {/* Remonté à chaque ouverture : l'enregistrement démarre aussitôt. */}
      {props.open && <RecorderBody {...props} onClose={close} onForceClose={props.onClose} setGuard={setGuard} />}
    </Modal>
  );
}

const MIME_TYPES = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4", "audio/webm"];

type Phase = "starting" | "recording" | "paused" | "stopped" | "saving";

function RecorderBody({
  editor,
  noteId,
  onClose,
  onForceClose,
  onAttachment,
  onError,
  setGuard,
}: Props & { onForceClose: () => void; setGuard: (fn: () => boolean) => void }) {
  const [phase, setPhase] = useState<Phase>("starting");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [recording, setRecording] = useState<{ blob: Blob; url: string } | null>(null);
  const [canTranscribe, setCanTranscribe] = useState(false);
  const [transcribe, setTranscribe] = useState(true);
  const [status, setStatus] = useState("");

  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(new Date());
  /** Durée enregistrée avant la dernière reprise, et instant de cette reprise */
  const clock = useRef({ before: 0, since: 0 });
  /** Numéro du démarrage en cours : un démarrage dépassé (fenêtre fermée entre-temps) libère son micro. */
  const session = useRef(0);

  const duration = () => clock.current.before + (clock.current.since ? (performance.now() - clock.current.since) / 1000 : 0);

  useEffect(() => {
    setGuard(() =>
      phase === "saving" ? false : phase === "starting" || duration() < 3 || window.confirm("Abandonner cet enregistrement ?"),
    );
  });

  useEffect(() => {
    getAlbertSettings()
      .then((s) => setCanTranscribe(s.configured))
      .catch(() => {});
  }, []);

  // Libère le micro et l'aperçu en quittant la fenêtre.
  useEffect(
    () => () => {
      session.current++;
      if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  useEffect(() => () => void (recording && URL.revokeObjectURL(recording.url)), [recording]);

  function restart() {
    setError("");
    setPhase("starting");
    setRecording(null);
    setElapsed(0);
    start();
  }

  async function start() {
    const id = ++session.current;
    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      if (id !== session.current) return;
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Accès au micro refusé. Autorisez-le dans les réglages du navigateur ou du système."
          : "Aucun micro disponible.",
      );
      setPhase("stopped");
      return;
    }
    if (id !== session.current) {
      media.getTracks().forEach((t) => t.stop());
      return;
    }
    stream.current = media;
    chunks.current = [];
    clock.current = { before: 0, since: 0 };
    const mimeType = MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    const rec = new MediaRecorder(media, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 64_000 });
    rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    rec.onstop = () => {
      if (id !== session.current) return;
      const blob = new Blob(chunks.current, { type: rec.mimeType.split(";")[0] || "audio/webm" });
      setRecording({ blob, url: URL.createObjectURL(blob) });
    };
    recorder.current = rec;
    startedAt.current = new Date();
    rec.start(1000);
    clock.current.since = performance.now();
    setPhase("recording");
  }

  // Démarrage immédiat à l'ouverture.
  useEffect(() => {
    start();
  }, []);

  // Chronomètre et niveau du micro pendant l'enregistrement.
  useEffect(() => {
    if (phase !== "recording" || !stream.current) return;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream.current).connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    let frame = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const v of samples) sum += ((v - 128) / 128) ** 2;
      setLevel(Math.min(1, Math.sqrt(sum / samples.length) * 4));
      setElapsed(duration());
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      ctx.close();
      setLevel(0);
    };
  }, [phase]);

  function pause() {
    recorder.current?.pause();
    clock.current = { before: duration(), since: 0 };
    setPhase("paused");
  }

  function resume() {
    recorder.current?.resume();
    clock.current.since = performance.now();
    setPhase("recording");
  }

  function stop() {
    clock.current = { before: duration(), since: 0 };
    setElapsed(clock.current.before);
    recorder.current?.stop();
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setPhase("stopped");
  }

  async function insert() {
    if (!recording) return;
    const { blob } = recording;
    setPhase("saving");
    const title = recordingTitle(startedAt.current);
    const file = new File([blob], title + audioExtension(blob.type), { type: blob.type });
    let attachment: AttachmentInfo;
    try {
      setStatus("Enregistrement du vocal…");
      attachment = await uploadAttachment(noteId, file);
      onAttachment(attachment);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement du vocal impossible.");
      setPhase("stopped");
      return;
    }
    let transcript: ReturnType<typeof transcriptParagraphs> = [];
    let transcriptError = "";
    if (canTranscribe && transcribe) {
      setStatus("Transcription par Albert…");
      try {
        const { text } = await transcribeAttachment(attachment.id);
        transcript = transcriptParagraphs(text);
      } catch (e) {
        transcriptError = `Vocal inséré, mais la transcription a échoué : ${e instanceof Error ? e.message : "erreur inconnue."}`;
      }
    }
    // Après la sélection, jamais à sa place ; le curseur passe ensuite derrière le vocal et sa transcription.
    const pos = editor.state.selection.to;
    const before = editor.state.doc.content.size;
    editor
      .chain()
      .focus()
      .insertContentAt(pos, [{ type: "audioClip", attrs: { src: attachment.url, title, duration: Math.round(clock.current.before) } }, ...transcript])
      .command(({ tr }) => {
        tr.setSelection(Selection.near(tr.doc.resolve(pos + tr.doc.content.size - before)));
        return true;
      })
      .run();
    onForceClose();
    if (transcriptError) onError(transcriptError);
  }

  const live = phase === "recording" || phase === "paused";

  return (
    <>
      <ModalHeader title="Enregistrer un vocal" onClose={onClose} />
      <div className="space-y-5 p-5">
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="flex items-center gap-2 text-sm text-ink-3" aria-live="polite">
            <span
              className={`h-2.5 w-2.5 rounded-full ${phase === "recording" ? "animate-pulse bg-danger" : "bg-line"}`}
              aria-hidden
            />
            {phase === "starting" && "Connexion au micro…"}
            {phase === "recording" && "Enregistrement en cours"}
            {phase === "paused" && "En pause"}
            {(phase === "stopped" || phase === "saving") && (recording ? "Enregistrement terminé" : "")}
          </div>
          <p className="font-serif text-4xl tabular-nums text-ink">{formatDuration(elapsed)}</p>
          <div className="h-1.5 w-48 overflow-hidden rounded-full bg-paper-3" aria-hidden>
            <div className="h-full rounded-full bg-ink-3 transition-[width] duration-75" style={{ width: `${level * 100}%` }} />
          </div>
        </div>

        {recording && phase !== "recording" && <audio src={recording.url} controls className="h-9 w-full" />}

        {canTranscribe && (phase === "stopped" || live) && (
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" checked={transcribe} onChange={(e) => setTranscribe(e.target.checked)} />
            Ajouter la transcription (Albert)
          </label>
        )}

        {phase === "saving" && (
          <p className="text-sm text-ink-3" role="status">
            {status}
          </p>
        )}
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2">
          {live && (
            <>
              {phase === "recording" ? (
                <button type="button" onClick={pause} className="btn-outline">
                  <Pause size={15} />
                  Pause
                </button>
              ) : (
                <button type="button" onClick={resume} className="btn-outline">
                  <Mic size={15} />
                  Reprendre
                </button>
              )}
              <button type="button" onClick={stop} className="btn-primary" data-autofocus>
                <Square size={13} fill="currentColor" />
                Terminer
              </button>
            </>
          )}
          {phase === "stopped" && (
            <>
              <button
                type="button"
                onClick={() => (!recording || window.confirm("Effacer cet enregistrement et recommencer ?")) && restart()}
                className="btn-ghost"
              >
                {recording ? <RotateCcw size={15} /> : <Play size={15} />}
                {recording ? "Recommencer" : "Réessayer"}
              </button>
              {recording && (
                <button type="button" onClick={insert} className="btn-primary" data-autofocus>
                  Insérer dans la note
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
