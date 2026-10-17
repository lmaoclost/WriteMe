import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Seal } from "../../ui/Seal";
import { fileToDataUrl } from "../../data/image";
import { useAccount } from "../../data/account";

const MAX_AVATAR_BYTES = 10 * 1024 * 1024;
const BIO_LIMIT = 500;

const SECTION = "bg-night border border-line rounded-lg p-5";
const SECTION_H3 = "font-display text-[1.25rem] font-semibold text-parchment-strong border-b border-line pb-2 mb-3";
const BIO_LABEL = "inline-flex items-baseline flex-wrap gap-1.5 text-parchment-dim text-sm mb-1";
const BIO_TEXTAREA =
  "w-full resize-y bg-ink text-parchment border border-line rounded-sm px-3 py-2.5 text-base placeholder:text-slate outline-none focus-visible:border-gold-dim";
const SAVE_BTN =
  "w-full mt-3 bg-gold text-wax border-0 rounded-sm px-5 py-3 text-base font-semibold cursor-pointer hover:brightness-[1.08] disabled:bg-night-2 disabled:text-slate disabled:cursor-not-allowed";

export function ProfilePage() {
  const user = useAccount();
  const saveBios = useAccount((s) => s.saveBios);
  const setAvatar = useAccount((s) => s.setAvatar);
  const clearAvatar = useAccount((s) => s.clearAvatar);

  const [readerBio, setReaderBio] = useState(user.readerBio);
  const [worldbuilderBio, setWorldbuilderBio] = useState(user.worldbuilderBio);
  const [authorBio, setAuthorBio] = useState(user.authorBio);
  const [bioError, setBioError] = useState<string | null>(null);
  const [bioSuccess, setBioSuccess] = useState("");
  const [avatarMsg, setAvatarMsg] = useState("");
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [avatarTick, setAvatarTick] = useState(0);

  const fileInput = useRef<HTMLInputElement>(null);

  const anyDirty =
    readerBio !== user.readerBio ||
    worldbuilderBio !== user.worldbuilderBio ||
    authorBio !== user.authorBio;

  const pickFile = () => fileInput.current?.click();

  const handleSave = () => {
    const tooLong = [readerBio, worldbuilderBio, authorBio].some((b) => b.length > BIO_LIMIT);
    if (tooLong) { setBioError("Bios must be 500 characters or fewer."); return; }
    saveBios({ readerBio, worldbuilderBio, authorBio });
    setBioSuccess("Profile saved.");
    setBioError(null);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    setAvatarError(null);
    setAvatarMsg("");
    if (!files || !files[0]) { setAvatarError("Please select an image file."); return; }
    const f = files[0];
    if (!f.type.startsWith("image/")) { setAvatarError("Please select an image file."); return; }
    if (f.size > MAX_AVATAR_BYTES) { setAvatarError("Image must be under 10MB."); return; }
    setUploading(true);
    try {
      const res = await fileToDataUrl(f, 512);
      setAvatar(res.dataUrl);
      setAvatarMsg("Avatar updated.");
      setAvatarTick((t) => t + 1);
    } catch {
      setAvatarMsg("");
      setAvatarError("Failed to upload avatar. Please try again.");
      setAvatarTick((t) => t + 1);
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = () => {
    clearAvatar();
    setAvatarMsg("Avatar removed.");
    setAvatarError(null);
    setAvatarTick((t) => t + 1);
  };

  const showViewPublic = Boolean(user.username);

  return (
    <div>
      <header className="bg-night border-b border-line flex items-center justify-between px-6 min-h-16">
        <h1 className="my-2.5">
          <Link to="/" className="inline-flex items-center gap-2.5 no-underline">
            <Seal letter="S" className="size-7 text-sm" />
            <span className="font-display text-[0.9375rem] font-semibold tracking-[0.14em] uppercase text-parchment-strong">Scriptorium</span>
          </Link>
        </h1>
        <div className="flex items-center gap-2.5">
          {showViewPublic && (
            <Link to={`/u/${user.username}`} className="rounded-sm border border-line bg-transparent px-3 py-1.5 text-sm text-slate no-underline cursor-pointer transition-colors hover:text-parchment-strong hover:border-gold-dim" title="See how others see your profile">
              View public profile
            </Link>
          )}
          <button type="button" onClick={() => window.history.back()} className="inline-block bg-transparent text-slate border border-line rounded-sm px-3.5 py-1.5 text-sm no-underline cursor-pointer transition-colors hover:text-parchment-strong hover:border-gold-dim">Back to Feed</button>
        </div>
      </header>
      <main className="max-w-[600px] mx-auto my-6 px-4 pb-12">
        <h2 className="font-display text-[1.375rem] font-semibold text-parchment-strong mt-2 mb-4">Profile Settings</h2>
        {bioSuccess && <p className="text-success">{bioSuccess}</p>}
        {bioError && <p className="text-danger">{bioError}</p>}
        {avatarError && <p className="text-danger">{avatarError}</p>}
        {avatarMsg && <p className="text-success">{avatarMsg}</p>}
        <div className={SECTION}>
          <h3 className={SECTION_H3}>Public Profile</h3>
          <div>
            <div className="flex gap-3 items-center relative">
              <button
                type="button"
                onClick={pickFile}
                title={user.avatarUrl ? "Click to change avatar" : "Click to upload avatar"}
                className="size-[72px] rounded-full border border-line-strong bg-night-2 text-gold overflow-hidden p-0 relative cursor-pointer hover:border-gold-dim"
              >
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-display text-[1.375rem] font-semibold text-gold">
                    {(user.username || user.email || "?").trim().charAt(0).toUpperCase()}
                  </span>
                )}
                {uploading && (
                  <span className="absolute inset-0 flex items-center justify-center rounded-full bg-[rgb(22_22_42/0.72)] text-parchment-strong text-[0.6875rem]">Uploading...</span>
                )}
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={pickFile} className={GHOST_AVATAR_BTN}>Upload</button>
                {user.avatarUrl && (
                  <button type="button" onClick={removeAvatar} className={GHOST_AVATAR_BTN}>
                    Remove
                  </button>
                )}
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={onFile}
                key={avatarTick}
              />
            </div>
            <div className="mt-4 flex flex-col gap-3.5">
              <div className="flex flex-col">
                <label htmlFor="readerBio" className={BIO_LABEL}>
                  About you <span className="text-[var(--text-faint)] text-xs">(optional)</span>
                </label>
                <textarea
                  id="readerBio"
                  value={readerBio}
                  maxLength={BIO_LIMIT}
                  rows={3}
                  placeholder="What kinds of stories or worlds do you love?"
                  onChange={(e) => { setReaderBio(e.target.value); if (bioError) setBioError(null); }}
                  className={BIO_TEXTAREA}
                />
                <div className="flex justify-end"><span className="text-[var(--text-faint)] text-xs [font-variant-numeric:tabular-nums]">{readerBio.length} / 500</span></div>
              </div>
              <div className="flex flex-col">
                <label htmlFor="worldbuilderBio" className={BIO_LABEL}>
                  Worldbuilder bio <span className="text-lilac text-xs">✦ Worldbuilder</span>
                </label>
                <p className="text-[var(--text-faint)] text-xs m-0 mb-1">Shown on your public worldbuilder page.</p>
                <textarea
                  id="worldbuilderBio"
                  value={worldbuilderBio}
                  maxLength={BIO_LIMIT}
                  rows={3}
                  placeholder="What kinds of worlds do you build?"
                  onChange={(e) => setWorldbuilderBio(e.target.value)}
                  className={BIO_TEXTAREA}
                />
                <div className="flex justify-end"><span className="text-[var(--text-faint)] text-xs [font-variant-numeric:tabular-nums]">{worldbuilderBio.length} / 500</span></div>
              </div>
              <div className="flex flex-col">
                <label htmlFor="authorBio" className={BIO_LABEL}>
                  Author bio <span className="text-lilac text-xs">✦ Author</span>
                </label>
                <p className="text-[var(--text-faint)] text-xs m-0 mb-1">Shown on your public author page.</p>
                <textarea
                  id="authorBio"
                  value={authorBio}
                  maxLength={BIO_LIMIT}
                  rows={3}
                  placeholder="What kinds of stories do you tell?"
                  onChange={(e) => setAuthorBio(e.target.value)}
                  className={BIO_TEXTAREA}
                />
                <div className="flex justify-end"><span className="text-[var(--text-faint)] text-xs [font-variant-numeric:tabular-nums]">{authorBio.length} / 500</span></div>
              </div>
              <button type="button" className={SAVE_BTN} disabled={!anyDirty} onClick={handleSave}>
                Save Profile
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

const GHOST_AVATAR_BTN = "bg-transparent text-slate border border-line rounded-sm py-1 px-2.5 text-xs cursor-pointer transition-colors hover:text-parchment-strong hover:border-gold-dim";