'use client';
import { Camera, Check, ImagePlus, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Pill } from '@/components/Badge';
import { Button } from '@/components/Button';
import { ErrorText, Input, Label, Select, Textarea } from '@/components/Field';
import { iconProps } from '@/components/icons';
import { Price } from '@/components/Price';
import { CATEGORIES, CONDITIONS, LAGOS_AREAS, conditionLabel } from '@/lib/areas';
import { messageFor } from '@/lib/errors';
import { MIN_START_PRICE_KOBO, parseNairaInput, previewStep } from '@/lib/money';
import { compressImage } from '@/lib/photos';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { formatGoLive, formatLagosDateTime } from '@/lib/time';

const MIN_PHOTOS = 3;
const MAX_PHOTOS = 8;
const STEPS = ['Photos', 'Details', 'Drop'] as const;

type Photo = { blob: Blob; url: string };
type Drop = { id: string; title: string; opens_at: string; lot_count: number };
type Stage = 0 | 1 | 2 | 'review' | 'done';

/** DESIGN.md › Sell flow: photos (3–8, camera-first) → details → drop → review. */
export function SellFlow({ drops, defaultArea }: { drops: Drop[]; defaultArea: string }) {
  const supabase = getBrowserSupabase();
  const [stage, setStage] = useState<Stage>(0);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [condition, setCondition] = useState('good');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [area, setArea] = useState(defaultArea);
  const [price, setPrice] = useState('');
  const [dropId, setDropId] = useState(drops[0]?.id ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lotId, setLotId] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const priceKobo = parseNairaInput(price);
  const priceOk = priceKobo !== null && priceKobo >= MIN_START_PRICE_KOBO;
  const drop = drops.find((d) => d.id === dropId);

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), [photos]);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [stage]);

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    setError(null);
    setBusy('Shrinking photos…');
    try {
      const next: Photo[] = [];
      for (const file of Array.from(files).slice(0, MAX_PHOTOS - photos.length)) {
        if (!file.type.startsWith('image/')) continue;
        const blob = await compressImage(file);
        next.push({ blob, url: URL.createObjectURL(blob) });
      }
      setPhotos((p) => [...p, ...next]);
    } catch {
      setError("One of those photos couldn't be read. Try a JPEG or PNG.");
    } finally {
      setBusy(null);
    }
  }

  function next() {
    setError(null);
    if (stage === 0 && photos.length < MIN_PHOTOS) return setError(`Add at least ${MIN_PHOTOS} photos.`);
    if (stage === 1) {
      if (title.trim().length < 3) return setError('Give your item a title (3 characters or more).');
      if (!area) return setError('Choose the pickup area.');
      if (!priceOk) return setError(messageFor('invalid_price'));
    }
    if (stage === 2 && !drop) return setError('Choose a drop.');
    setStage(stage === 0 ? 1 : stage === 1 ? 2 : 'review');
  }

  async function submit() {
    if (!priceOk || priceKobo === null) return;
    setError(null);
    setBusy('Creating your lot…');
    const { data: auctionId, error: createErr } = await supabase.rpc('create_listing', {
      p_drop_id: dropId, p_title: title, p_description: description, p_condition: condition,
      p_category: category, p_area: area, p_start_price: priceKobo,
    });
    if (createErr || !auctionId) {
      setBusy(null);
      return setError(messageFor(createErr?.message));
    }
    try {
      for (let i = 0; i < photos.length; i++) {
        setBusy(`Uploading photo ${i + 1} of ${photos.length}…`);
        const photo = photos[i]!;
        const ext = photo.blob.type === 'image/webp' ? 'webp' : 'jpg';
        const path = `${auctionId}/${i}-${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('lot-photos')
          .upload(path, photo.blob, { contentType: photo.blob.type, cacheControl: '31536000', upsert: false });
        if (upErr) throw upErr;
        const { error: addErr } = await supabase.rpc('add_auction_photo', { p_auction_id: auctionId, p_storage_path: path, p_position: i });
        if (addErr) throw addErr;
      }
    } catch {
      // Don't leave a lot without photos in the drop.
      await supabase.rpc('cancel_listing', { p_auction_id: auctionId });
      setBusy(null);
      return setError("Photo upload failed, so the lot wasn't listed. Check your connection and try again.");
    }
    setBusy(null);
    setLotId(auctionId);
    setStage('done');
  }

  if (stage === 'done' && drop && lotId) {
    return (
      <div className="space-y-4 rounded-card bg-surface p-6 text-center shadow-elev">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-pill bg-winning-soft">
          <Check {...iconProps} size={24} className="text-winning" />
        </span>
        <h1 className="font-display text-display">Your lot goes live {formatGoLive(drop.opens_at)}</h1>
        <p className="text-ink-muted">Bidding opens with the {drop.title.toLowerCase()}. We&apos;ll tell you when it sells.</p>
        <div className="flex flex-col gap-2">
          <Link href={`/lot/${lotId}`} className="inline-flex min-h-11 items-center justify-center rounded-pill bg-ink font-semibold text-white">View your lot</Link>
          <button type="button" className="min-h-11 font-semibold text-focus" onClick={() => window.location.reload()}>List another item</button>
        </div>
      </div>
    );
  }

  const stepIndex = typeof stage === 'number' ? stage : 3;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-display">{stage === 'review' ? 'Review your lot' : 'Sell an item'}</h1>
        <ol className="mt-3 flex gap-2" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s} className="flex-1" aria-current={i === stepIndex ? 'step' : undefined}>
              <span className={`block h-1 rounded-pill ${i <= stepIndex ? 'bg-ink' : 'bg-line'}`} />
              <span className={`mt-1 block text-eyebrow uppercase ${i === stepIndex ? 'text-ink' : 'text-ink-muted'}`}>{i + 1}. {s}</span>
            </li>
          ))}
        </ol>
      </div>

      {stage === 0 && (
        <section className="space-y-3">
          <p className="text-ink-muted">Add {MIN_PHOTOS} to {MAX_PHOTOS} real photos in good light. The first one is the cover.</p>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" aria-hidden tabIndex={-1}
            onChange={(e) => { void addPhotos(e.target.files); e.target.value = ''; }} />
          <input ref={galleryRef} type="file" accept="image/*" multiple className="sr-only" aria-label="Choose photos from gallery"
            onChange={(e) => { void addPhotos(e.target.files); e.target.value = ''; }} />
          <div className="grid grid-cols-2 gap-2">
            <Button tall onClick={() => cameraRef.current?.click()} disabled={photos.length >= MAX_PHOTOS || Boolean(busy)}>
              <Camera {...iconProps} size={20} /> Take a photo
            </Button>
            <Button tall variant="secondary" onClick={() => galleryRef.current?.click()} disabled={photos.length >= MAX_PHOTOS || Boolean(busy)}>
              <ImagePlus {...iconProps} size={20} /> From gallery
            </Button>
          </div>
          <p className="text-body text-ink-muted">
            <span className="font-num tabular-nums">{photos.length}</span> of {MAX_PHOTOS} · {busy ?? 'Photos are shrunk before upload to save data.'}
          </p>
          {photos.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {photos.map((p, i) => (
                <div key={p.url} className="relative aspect-square overflow-hidden rounded-card border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                  {i === 0 && <span className="absolute bottom-1 left-1 rounded-pill bg-surface px-1 text-[11px] font-semibold">Cover</span>}
                  <button type="button" onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))} aria-label={`Remove photo ${i + 1}`}
                    className="absolute right-0 top-0 flex h-11 w-11 items-start justify-end p-1">
                    <span className="rounded-pill bg-surface p-0.5"><X {...iconProps} size={14} /></span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {stage === 1 && (
        <section className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" minLength={3} maxLength={80} placeholder="e.g. Binatone standing fan" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="category">Category</Label>
              <Select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="condition">Condition</Label>
              <Select id="condition" value={condition} onChange={(e) => setCondition(e.target.value)}>
                {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="area">Pickup area</Label>
            <Select id="area" value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">Choose…</option>
              {LAGOS_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="price">Asking price (₦)</Label>
            <Input id="price" inputMode="numeric" placeholder="25,000" className="font-num text-heading tabular-nums" value={price} onChange={(e) => setPrice(e.target.value)} />
            <p className="mt-1 text-body text-ink-muted">
              {priceOk && priceKobo !== null
                ? <>Bidding opens at <Price kobo={priceKobo} /> and goes up by at least <Price kobo={previewStep(priceKobo)} />.</>
                : 'Your asking price is the opening bid. Minimum ₦500.'}
            </p>
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={4} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Age, faults, what's included, pickup notes" />
          </div>
        </section>
      )}

      {stage === 2 && (
        <section className="space-y-2" role="radiogroup" aria-label="Choose a drop">
          {drops.map((d) => (
            <label key={d.id} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-card border bg-surface p-3 ${d.id === dropId ? 'border-ink' : 'border-line'}`}>
              <input type="radio" name="drop" value={d.id} checked={d.id === dropId} onChange={() => setDropId(d.id)} className="h-4 w-4 accent-[var(--ink)]" />
              <span>
                <span className="block font-semibold">{d.title}</span>
                <span className="block text-body text-ink-muted">Opens {formatLagosDateTime(d.opens_at)} · <span className="font-num tabular-nums">{d.lot_count}</span> lots</span>
              </span>
            </label>
          ))}
        </section>
      )}

      {stage === 'review' && drop && priceKobo !== null && (
        <section className="space-y-3 rounded-card bg-surface p-4 shadow-elev">
          <div className="flex gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photos[0]?.url} alt="" className="aspect-[4/3] w-28 rounded-card object-cover" />
            <div className="min-w-0">
              <p className="font-semibold">{title}</p>
              <div className="mt-1 flex flex-wrap gap-1"><Pill>{area}</Pill><Pill>{conditionLabel(condition)}</Pill><Pill>{category}</Pill></div>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <div><dt className="text-eyebrow uppercase text-ink-muted">Opening bid</dt><dd><Price kobo={priceKobo} className="text-price-card" /></dd></div>
            <div><dt className="text-eyebrow uppercase text-ink-muted">Min step</dt><dd><Price kobo={previewStep(priceKobo)} className="text-price-card" /></dd></div>
            <div className="col-span-2"><dt className="text-eyebrow uppercase text-ink-muted">Drop</dt><dd>{drop.title} · opens {formatLagosDateTime(drop.opens_at)}</dd></div>
            <div className="col-span-2"><dt className="text-eyebrow uppercase text-ink-muted">Photos</dt><dd className="font-num tabular-nums">{photos.length}</dd></div>
          </dl>
          <p className="text-body text-ink-muted">
            When it sells, the buyer pays us first. We pay you the winning bid minus our fee once you get the buyer&apos;s handover code at pickup.
          </p>
        </section>
      )}

      <ErrorText>{error}</ErrorText>

      <div className="flex gap-2">
        {stage !== 0 && (
          <Button variant="secondary" disabled={Boolean(busy)}
            onClick={() => { setError(null); setStage(stage === 'review' ? 2 : stage === 2 ? 1 : 0); }}>
            Back
          </Button>
        )}
        {stage === 'review' ? (
          <Button block tall busy={Boolean(busy)} onClick={submit}>{busy ?? 'List my lot'}</Button>
        ) : (
          <Button block tall disabled={Boolean(busy)} onClick={next}>Next</Button>
        )}
      </div>
    </div>
  );
}
