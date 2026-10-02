import { useEffect, useState, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ScanIcon } from '../components/layout/icons'
import LoadingStamp from '../components/LoadingStamp'
import PatchCard from '../components/PatchCard'
import { useAuth } from '../context/AuthProvider'
import { usePatches } from '../hooks/usePatches'
import { removeBackgroundViaCloudflareForFile } from '../lib/cloudflareBackgroundRemoval'
import {
  analyzePatchPhoto,
  cosineSimilarity,
  hammingDistance,
  parseEmbedding,
  preloadImageMatchModel,
} from '../lib/imageMatch'
import type { PatchWithPhotos } from '../types/patch'

const CONFIDENT_THRESHOLD = 0.75
const PHASH_BONUS_DISTANCE = 6
const PHASH_BONUS = 0.03

// Scanning tries the raw camera photo first, because that skips the upload +
// Worker + Cloudflare round trip that isolating the patch requires. Stored
// embeddings come from background-removed images, so raw scores sit lower —
// hence its own, lower threshold. Isolation still runs whenever the raw pass
// doesn't clear it.
//
// PROVISIONAL: calibrate against more patches, more backgrounds, and at least
// one patch that isn't in the collection (the false-positive case).
const RAW_CONFIDENT_THRESHOLD = 0.65

type Candidate = { patch: PatchWithPhotos; score: number }

/** Temporary: here while the raw-pass thresholds above are being calibrated.
 * Remove once they're settled. */
function logPass(pass: 'raw' | 'isolated', scored: Candidate[]) {
  const [first, second] = scored
  const ratio = first && second ? (first.score / second.score).toFixed(2) : 'n/a'
  console.log(
    `[scan:${pass}] top1=${first?.score.toFixed(4) ?? 'n/a'} (${first?.patch.location_name ?? '-'}) ` +
      `top2=${second?.score.toFixed(4) ?? 'n/a'} ratio=${ratio}`,
  )
  console.table(scored.map((c) => ({ patch: c.patch.location_name, score: c.score.toFixed(4) })))
}

export default function Scan() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: patches } = usePatches()
  const [stage, setStage] = useState<'idle' | 'isolating' | 'comparing'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const analyzing = stage !== 'idle'

  // Start warming the match model as soon as this page opens, so it's likely
  // already loaded by the time the user's actually picked a photo. Background
  // removal runs server-side, so there's nothing to warm up for it.
  useEffect(() => {
    preloadImageMatchModel()
  }, [])

  async function isolatePatch(file: File): Promise<Blob> {
    if (!user) throw new Error('Not signed in')
    return removeBackgroundViaCloudflareForFile(file, user.id)
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setError(null)
    setCandidates(null)
    setPreview(URL.createObjectURL(file))
    preloadImageMatchModel()

    function scoreAgainstCollection(scanEmbedding: number[], scanPhash: bigint): Candidate[] {
      const scored: Candidate[] = (patches ?? []).flatMap((patch) => {
        const cover = patch.patch_photos.find((p) => p.is_cover)
        const embedding = parseEmbedding(cover?.embedding)
        if (!embedding) return []

        let score = cosineSimilarity(scanEmbedding, embedding)
        if (cover?.phash) {
          const distance = hammingDistance(scanPhash, BigInt(cover.phash))
          if (distance <= PHASH_BONUS_DISTANCE) score = Math.min(1, score + PHASH_BONUS)
        }
        return [{ patch, score }]
      })
      scored.sort((a, b) => b.score - a.score)
      return scored
    }

    try {
      // Fast path: the unmodified camera photo, scored locally. No upload, no
      // Worker, no network beyond what's already loaded.
      setStage('comparing')
      const raw = await analyzePatchPhoto(file)
      const rawScored = scoreAgainstCollection(raw.embedding, raw.phash)
      logPass('raw', rawScored)

      if (rawScored[0] && rawScored[0].score >= RAW_CONFIDENT_THRESHOLD) {
        setCandidates(rawScored.slice(0, 3))
        navigate(`/patches/${rawScored[0].patch.id}`)
        return
      }

      // Nothing convincing, so pay for isolation — matching the way the stored
      // reference photos were processed, which is the stronger comparison.
      setStage('isolating')
      const isolated = await isolatePatch(file)

      setStage('comparing')
      const { embedding: scanEmbedding, phash: scanPhash } = await analyzePatchPhoto(isolated)
      const scored = scoreAgainstCollection(scanEmbedding, scanPhash)
      logPass('isolated', scored)

      const top = scored.slice(0, 3)
      setCandidates(top)

      if (top[0] && top[0].score >= CONFIDENT_THRESHOLD) {
        navigate(`/patches/${top[0].patch.id}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not analyze that photo.')
    } finally {
      setStage('idle')
    }
  }

  const noIndexedPatches = candidates !== null && candidates.length === 0
  const noConfidentMatch = candidates !== null && candidates.length > 0 && candidates[0].score < CONFIDENT_THRESHOLD

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal/10 text-teal">
          <ScanIcon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold text-teal-dark">Scan a patch</h1>
          <p className="text-sm text-ink/60">Photograph a patch to find it in your collection.</p>
        </div>
      </div>

      <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-teal/30 bg-white/40 px-6 py-16 text-center hover:bg-teal/5">
        {preview ? (
          <img src={preview} alt="" className="h-32 w-32 rounded-xl object-cover" />
        ) : (
          <ScanIcon className="h-10 w-10 text-teal" />
        )}
        <span className="flex items-center gap-2 font-medium text-teal-dark">
          {analyzing && <LoadingStamp className="h-5 w-5" />}
          {stage === 'isolating' && 'Isolating patch…'}
          {stage === 'comparing' && 'Comparing…'}
          {stage === 'idle' && 'Take or choose a photo'}
        </span>
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
      </label>

      {error && <p className="mt-4 text-sm text-terracotta-dark">{error}</p>}

      {!analyzing && noIndexedPatches && (
        <p className="mt-4 text-sm text-ink/60">
          None of your patches are indexed for matching yet — add a "photo of the patch" to at least one patch
          first.
        </p>
      )}

      {!analyzing && noConfidentMatch && (
        <div className="mt-6">
          <p className="mb-3 text-sm text-ink/60">No confident match — did you mean one of these?</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {candidates!.map(({ patch }) => (
              <PatchCard key={patch.id} patch={patch} />
            ))}
          </div>
          <Link
            to="/patches/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-cream shadow-sm hover:bg-terracotta-dark"
          >
            Create new patch instead
          </Link>
        </div>
      )}
    </div>
  )
}
