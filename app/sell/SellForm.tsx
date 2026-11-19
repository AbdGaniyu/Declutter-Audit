'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { ErrorText, Input, Label, Select, Textarea } from '@/components/Field';
import { CATEGORIES, CONDITIONS, LAGOS_AREAS } from '@/lib/areas';
import { messageFor } from '@/lib/errors';
import { MIN_START_PRICE_KOBO, formatNaira, parseNairaInput, previewStep } from '@/lib/money';
import { compressImage } from '@/lib/photos';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { formatLagosDateTime } from '@/lib/time';

const MAX_PHOTOS = 6;

type Photo = { blob: Blob; url: string };

export function SellForm({
  drops,
  defaultArea,
}: {
  drops: { id: string; title: string; opens_at: string; lot_count: number }[];
  defaultArea: string;
}) {
  const supabase = getBrowserSupabase();
  const router = useRouter();
  const [dropId, setDropId] = useState(drops[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [condition, setCondition] = useState('good');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [area, setArea] = useState(defaultArea);
  const [price, setPrice] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const priceKobo = parseNairaInput(price);
  const priceOk = priceKobo !== null && priceKobo >= MIN_START_PRICE_KOBO;

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), [photos]);

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    setError(null);
    setBusy('Compressing photos…');
    try {
      const room = MAX_PHOTOS - photos.length;
      const next: Photo[] = [];
      for (const file of Array.from(files).slice(0, room)) {
        if (!file.type.startsWith('image/')) continue;
        const blob = await compressImage(file);
        next.push({ blob, url: URL.createObjectURL(blob) });
      }
      setPhotos((p) => [...p, ...next]);
    } catch {
      setError('One of those photos could not be read. Try a JPEG or PNG.');
    } finally {
      setBusy(null);
    }
  }

  function removePhoto(i: number) {
    setPhotos((p) => p.filter((_, j) => j !== i));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!priceOk || priceKobo === null) return setError(messageFor('invalid_price'));
    if (photos.length === 0) return setError('Add at least one photo.');
    if (!area) return setError('Choose the area for pickup.');
    setError(null);
    setBusy('Creating your lot…');

    const { data: auctionId, error: createErr } = await supabase.rpc('create_listing', {
      p_drop_id: dropId,
      p_title: title,
      p_description: description,
      p_condition: condition,
      p_category: category,
      p_area: area,
      p_start_price: priceKobo,
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
        const { error: upErr } = await supabase.storage
          .from('lot-photos')
          .upload(path, photo.blob, { contentType: photo.blob.type, cacheControl: '31536000', upsert: false });
        if (upErr) throw upErr;
        const { error: addErr } = await supabase.rpc('add_auction_photo', {
          p_auction_id: auctionId,
          p_storage_path: path,
          p_position: i,
        });
        if (addErr) throw addErr;
      }
    } catch {
      // Don't leave a photo-less lot in the drop.
      await supabase.rpc('cancel_listing', { p_auction_id: auctionId });
      setBusy(null);
      return setError('Photo upload failed, so the lot was not listed. Check your connection and try again.');
    }

    router.push(`/lot/${auctionId}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <Label>Photos ({photos.length}/{MAX_PHOTOS})</Label>
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p, i) => (
            <div key={p.url} className="relative aspect-square overflow-hidden rounded-card border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
              <button type="button" onClick={() => removePhoto(i)} aria-label={`Remove photo ${i + 1}`}
                className="absolute right-1 top-1 rounded-pill bg-surface px-2 text-small font-bold text-ink">
                ×
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <label className="flex aspect-square cursor-pointer items-center justify-center rounded-card border border-dashed border-line bg-surface text-small text-muted">
              + Add
              <input type="file" accept="image/*" multiple className="sr-only"
                onChange={(e) => { void addPhotos(e.target.files); e.target.value = ''; }} />
            </label>
          )}
        </div>
        <p className="mt-1 text-small text-muted">The first photo is the cover. Photos are shrunk before upload to save data.</p>
      </div>

      <div>
        <Label htmlFor="title">Title</Label>
        <Input id="title" minLength={3} maxLength={80} placeholder="e.g. Binatone standing fan" value={title}
          onChange={(e) => setTitle(e.target.value)} required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="condition">Condition</Label>
          <Select id="condition" value={condition} onChange={(e) => setCondition(e.target.value)}>
            {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="category">Category</Label>
          <Select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={4} maxLength={2000} value={description}
          placeholder="Age, faults, what's included, pickup notes" onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div>
        <Label htmlFor="area">Pickup area</Label>
        <Select id="area" value={area} onChange={(e) => setArea(e.target.value)} required>
          <option value="">Choose…</option>
          {LAGOS_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
        </Select>
      </div>

      <div>
        <Label htmlFor="price">Asking price (₦)</Label>
        <Input id="price" inputMode="numeric" placeholder="25,000" value={price}
          onChange={(e) => setPrice(e.target.value)} required />
        <p className="mt-1 text-small text-muted">
          {priceOk && priceKobo !== null
            ? `Bidding opens at ${formatNaira(priceKobo)} and goes up in steps of at least ${formatNaira(previewStep(priceKobo))}.`
            : 'Minimum ₦500, whole naira.'}
        </p>
      </div>

      <div>
        <Label htmlFor="drop">Drop</Label>
        <Select id="drop" value={dropId} onChange={(e) => setDropId(e.target.value)}>
          {drops.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title} · opens {formatLagosDateTime(d.opens_at)} · {d.lot_count} lots
            </option>
          ))}
        </Select>
      </div>

      <ErrorText>{error}</ErrorText>
      <Button type="submit" block disabled={Boolean(busy)}>{busy ?? 'List my item'}</Button>
    </form>
  );
}
