'use client';
import { ArrowLeft, Camera, Check, Gavel, ImagePlus, MapPin, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Pill } from '@/components/Badge';
import { Button } from '@/components/Button';
import { ErrorText, Input, Label, Select, Textarea } from '@/components/Field';
import { GroupedRow, TrustCard } from '@/components/GroupedList';
import { iconProps } from '@/components/icons';
import { Price } from '@/components/Price';
import { CATEGORIES, CONDITIONS, LAGOS_AREAS, conditionLabel } from '@/lib/areas';
import { messageFor } from '@/lib/errors';
import { MIN_START_PRICE_KOBO, formatNaira, parseNairaInput, previewStep } from '@/lib/money';
import { compressImage } from '@/lib/photos';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { LAGOS_TZ, formatGoLive, formatLagosTime } from '@/lib/time';

const MIN_PHOTOS = 3;
const MAX_PHOTOS = 8;
const TITLE_MAX = 60;
const STEPS = ['Photos', 'Details', 'Drop'] as const;

const CONDITION_HINT: Record<string, string> = {
  new: 'New: never used, still in the box.',
  like_new: 'Like new: barely used, no marks.',
  good: 'Good: used and works well, light marks.',
  fair: 'Fair: visible wear, still works.',
  for_parts: "For parts: doesn't fully work.",
};

type Photo = { blob: Blob; url: string };
type Drop = { id: string; title: string; opens_at: string; lot_count: number };
type Stage = 0 | 1 | 2 | 'review' | 'done';

function dropWhen(iso: string): string {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat('en-NG', { weekday: 'short', day: 'numeric', month: 'short', timeZone: LAGOS_TZ }).format(d);
  return `${day}, ${formatLagosTime(iso)}`;
}

/** DESIGN.md › Key screens › Sell flow (PDF p.7, 9, 11, 12, drawn in v2). */
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

  function back() {
    setError(null);
    setStage(stage === 'review' ? 2 : stage === 2 ? 1 : 0);
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
      <div className="space-y-6 py-10 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-pill bg-fill">
          <Check {...iconProps} size={28} />
        </span>
        <div>
          <h1 className="text-title-sm md:text-title">Your lot goes live {formatGoLive(drop.opens_at)}</h1>
          <p className="mt-2 text-body text-secondary">Bidding opens with {drop.title}. We&apos;ll tell you when it sells.</p>
        </div>
        <div className="flex flex-col gap-2">
          <Link href={`/lot/${lotId}`} className="pressable inline-flex min-h-14 items-center justify-center rounded-pill bg-label text-headline text-on-label">View your lot</Link>
          <Button variant="text" block onClick={() => window.location.reload()}>List another item</Button>
        </div>
      </div>
    );
  }

  const stepIndex = typeof stage === 'number' ? stage : 3;

  return (
    <div className="space-y-6 pb-28">
      <header className="space-y-4">
        <div className="flex items-center gap-2">
          {stage === 0 ? (
            <Link href="/" aria-label="Close" className="pressable -ml-2 flex h-11 w-11 items-center justify-center rounded-pill"><X {...iconProps} size={22} /></Link>
          ) : (
            <button type="button" onClick={back} disabled={Boolean(busy)} aria-label="Back" className="pressable -ml-2 flex h-11 w-11 items-center justify-center rounded-pill">
              <ArrowLeft {...iconProps} size={22} />
            </button>
          )}
          <p className="text-headline">Sell an item</p>
          <p className="ml-auto text-subhead text-secondary">{stage === 'review' ? 'Review' : `Step ${stepIndex + 1} of 3`}</p>
        </div>
        {stage !== 'review' && (
          <ol className="flex gap-2" aria-label="Progress">
            {STEPS.map((s, i) => (
              <li key={s} className="flex-1" aria-current={i === stepIndex ? 'step' : undefined}>
                <span className={`block h-1 rounded-pill transition-colors duration-300 ${i <= stepIndex ? 'bg-label' : 'bg-fill'}`} />
                <span className={`mt-2 block text-footnote ${i === stepIndex ? 'font-semibold text-label' : 'text-secondary'}`}>{s}</span>
              </li>
            ))}
          </ol>
        )}
      </header>

      {stage === 0 && (
        <section className="space-y-5">
          <div>
            <h1 className="text-title-sm md:text-title">Add {MIN_PHOTOS} to {MAX_PHOTOS} photos</h1>
            <p className="mt-2 text-body text-secondary">Use real photos in daylight. Show any marks up close so buyers know what they&apos;re getting.</p>
          </div>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" aria-hidden tabIndex={-1}
            onChange={(e) => { void addPhotos(e.target.files); e.target.value = ''; }} />
          <input ref={galleryRef} type="file" accept="image/*" multiple className="sr-only" aria-label="Choose photos from gallery"
            onChange={(e) => { void addPhotos(e.target.files); e.target.value = ''; }} />
          <button type="button" onClick={() => cameraRef.current?.click()} disabled={photos.length >= MAX_PHOTOS || Boolean(busy)}
            className="pressable squircle flex w-full items-center gap-4 rounded-group bg-label p-4 text-left text-on-label disabled:opacity-50">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-pill bg-on-label text-label"><Camera {...iconProps} size={24} /></span>
            <span><span className="block text-headline">Take photos</span><span className="block text-subhead opacity-70">Opens your camera</span></span>
          </button>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-eyebrow uppercase text-secondary">Your photos</p>
              <p className="tnum text-subhead font-semibold">{photos.length} of {MAX_PHOTOS}</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p, i) => (
                <div key={p.url} className="squircle relative aspect-square overflow-hidden rounded-thumb bg-fill">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                  {i === 0 && <span className="absolute bottom-2 left-2 rounded-pill bg-label px-2 py-0.5 text-eyebrow uppercase text-on-label">Cover</span>}
                  <button type="button" onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))} aria-label={`Remove photo ${i + 1}`}
                    className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center">
                    <span className="glass-chip flex h-7 w-7 items-center justify-center rounded-pill"><X {...iconProps} size={14} /></span>
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button type="button" onClick={() => galleryRef.current?.click()} disabled={Boolean(busy)}
                  className="pressable squircle flex aspect-square flex-col items-center justify-center gap-1 rounded-thumb bg-fill text-subhead font-semibold disabled:opacity-50">
                  <ImagePlus {...iconProps} size={22} /> Gallery
                </button>
              )}
            </div>
            <p className="mt-2 text-footnote text-secondary" aria-live="polite">{busy ?? 'Photos are shrunk before upload to save data.'}</p>
          </div>

          <ul className="squircle space-y-2 rounded-group bg-surface p-4 text-subhead">
            <li className="flex gap-2"><Check {...iconProps} size={18} className="mt-0.5 shrink-0" /> Front, back and one close-up of any wear</li>
            <li className="flex gap-2"><Check {...iconProps} size={18} className="mt-0.5 shrink-0" /> Plain background, no filters</li>
          </ul>
        </section>
      )}

      {stage === 1 && (
        <section className="space-y-5">
          <div>
            <h1 className="text-title-sm md:text-title">Tell buyers about it</h1>
            <p className="mt-2 text-body text-secondary">Short and honest works best.</p>
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <Label htmlFor="title">Title</Label>
              <span className="tnum text-footnote text-secondary" aria-hidden>{title.length}/{TITLE_MAX}</span>
            </div>
            <Input id="title" minLength={3} maxLength={TITLE_MAX} placeholder="Brass table lamp, linen shade" value={title}
              aria-describedby="title-hint" onChange={(e) => setTitle(e.target.value)} />
            <p id="title-hint" className="mt-2 text-footnote text-secondary">What it is, then one detail that matters.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="category">Category</Label>
              <Select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="area">Pickup area</Label>
              <Select id="area" value={area} onChange={(e) => setArea(e.target.value)}>
                <option value="">Choose…</option>
                {LAGOS_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
              </Select>
            </div>
          </div>
          <fieldset>
            <legend className="mb-2 text-subhead font-semibold">Condition</legend>
            <div role="radiogroup" aria-label="Condition" className="flex flex-wrap gap-2">
              {CONDITIONS.map((c) => (
                <button key={c.value} type="button" role="radio" aria-checked={condition === c.value} onClick={() => setCondition(c.value)}
                  className={`pressable min-h-11 rounded-pill px-4 text-subhead font-semibold transition-colors duration-300
                    ${condition === c.value ? 'bg-label text-on-label' : 'bg-surface text-label'}`}>
                  {c.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-footnote text-secondary">{CONDITION_HINT[condition]}</p>
          </fieldset>
          <div>
            <Label htmlFor="price">Asking price</Label>
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-title-sm text-secondary">₦</span>
              <Input id="price" inputMode="numeric" placeholder="7,000" className="tnum pl-10 text-title-sm" value={price}
                aria-describedby="price-hint" onChange={(e) => setPrice(e.target.value)} />
            </div>
            <p id="price-hint" className="squircle mt-2 flex gap-2 rounded-control bg-surface p-3 text-subhead">
              <Gavel {...iconProps} size={18} className="mt-0.5 shrink-0" />
              <span>
                {priceOk && priceKobo !== null
                  ? <>Bidding starts at your price. Bids then go up in <Price kobo={previewStep(priceKobo)} className="font-semibold" /> steps.</>
                  : 'Your asking price is the opening bid. Minimum ₦500.'}
              </span>
            </p>
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <Label htmlFor="description">Description</Label>
              <span className="text-footnote text-secondary">Optional</span>
            </div>
            <Textarea id="description" rows={4} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Age, faults, what's included, pickup notes" />
          </div>
        </section>
      )}

      {stage === 2 && (
        <section className="space-y-5">
          <div>
            <h1 className="text-title-sm md:text-title">Choose a drop</h1>
            <p className="mt-2 text-body text-secondary">Your lot goes live with the drop and closes in turn with the others.</p>
          </div>
          <div role="radiogroup" aria-label="Choose a drop" className="space-y-2">
            {drops.map((d) => {
              const on = d.id === dropId;
              return (
                <label key={d.id} className={`squircle flex min-h-16 cursor-pointer items-center gap-3 rounded-group bg-surface p-4 transition-shadow duration-300
                  ${on ? 'shadow-[0_0_0_2px_var(--label)]' : ''}`}>
                  <input type="radio" name="drop" value={d.id} checked={on} onChange={() => setDropId(d.id)} className="sr-only" aria-label={d.title} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-headline">{d.title}</span>
                    <span className="block text-subhead text-secondary">Opens {dropWhen(d.opens_at)} · <span className="tnum">{d.lot_count}</span> lots</span>
                  </span>
                  <span aria-hidden className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-pill ${on ? 'bg-label text-on-label' : 'bg-fill'}`}>
                    {on && <Check {...iconProps} size={14} strokeWidth={2.5} />}
                  </span>
                </label>
              );
            })}
          </div>
        </section>
      )}

      {stage === 'review' && drop && priceKobo !== null && (
        <section className="space-y-4">
          <h1 className="text-title-sm md:text-title">Check and list</h1>
          <div className="squircle overflow-hidden rounded-group bg-surface">
            <div className="grid aspect-[16/9] grid-cols-[2fr_1fr] grid-rows-2 gap-0.5 bg-fill">
              {photos.slice(0, 3).map((p, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p.url} src={p.url} alt="" className={`h-full w-full object-cover ${i === 0 ? 'row-span-2' : ''}`} />
              ))}
            </div>
            <div className="p-4">
              <h2 className="text-title-sm">{title}</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                <Pill><MapPin {...iconProps} size={14} /> {area}</Pill><Pill>{conditionLabel(condition)}</Pill><Pill>{category}</Pill>
              </div>
              <dl className="mt-3">
                <GroupedRow label="Starting bid"><Price kobo={priceKobo} /></GroupedRow>
                <GroupedRow label="Bid steps"><Price kobo={previewStep(priceKobo)} /></GroupedRow>
                <GroupedRow label="Drop">
                  <span className="inline-flex items-center gap-2">
                    {dropWhen(drop.opens_at)}
                    <button type="button" className="font-semibold underline underline-offset-2" onClick={() => setStage(2)}>Change</button>
                  </span>
                </GroupedRow>
              </dl>
            </div>
          </div>
          <TrustCard title="You get paid at pickup">
            The winner pays in the app. You get paid once they hand you their 6-digit code at pickup, minus our fee.
          </TrustCard>
        </section>
      )}

      <ErrorText>{error}</ErrorText>

      <div className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 [background:linear-gradient(to_top,var(--bg)_70%,transparent)]">
        <div className="mx-auto max-w-lot">
          {stage === 'review' ? (
            <Button block tall busy={Boolean(busy)} onClick={submit}>{busy ?? 'List my lot'}</Button>
          ) : (
            <Button block tall disabled={Boolean(busy)} onClick={next}>Continue</Button>
          )}
          {stage === 'review' && priceKobo !== null && (
            <p className="mt-2 text-center text-footnote text-secondary">Opening bid {formatNaira(priceKobo)} · bids are final</p>
          )}
        </div>
      </div>
    </div>
  );
}
