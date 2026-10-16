import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fileToDataUrl } from "../../data/image";
import { useAccount } from "../../data/account";
import "./account.css";

const MAX_AVATAR_BYTES = 10 * 1024 * 1024;
const BIO_LIMIT = 500;

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
      const res = await fileToDataUrl(f);
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
    <div className="profile-settings">
      <header>
        <h1><Link to="/">Scriptorium</Link></h1>
        <div className="header-actions">
          {showViewPublic && (
            <Link to={`/u/${user.username}`} className="view-public-btn" title="See how others see your profile">
              View public profile
            </Link>
          )}
          <button type="button" className="back-btn" onClick={() => window.history.back()}>Back to Feed</button>
                  </div>
      </header>
      <main className="profile-content">
        <h2>Profile Settings</h2>
        {bioSuccess && <p className="success-message">{bioSuccess}</p>}
        {bioError && <p className="error-message">{bioError}</p>}
        {avatarError && <p className="error-message">{avatarError}</p>}
        {avatarMsg && <p className="success-message">{avatarMsg}</p>}
        <div className="settings-section">
          <h3>Public Profile</h3>
          <div className="public-profile">
            <div className="avatar-stack">
              <button
                type="button"
                className="avatar-btn"
                onClick={pickFile}
                title={user.avatarUrl ? "Click to change avatar" : "Click to upload avatar"}
              >
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" />
                ) : (
                  <span className="avatar-placeholder">
                    {(user.username || user.email || "?").trim().charAt(0).toUpperCase()}
                  </span>
                )}
                {uploading && <span className="avatar-uploading-overlay">Uploading...</span>}
              </button>
              <div className="avatar-buttons">
                <button type="button" className="avatar-action-btn" onClick={pickFile}>Upload</button>
                {user.avatarUrl && (
                  <button type="button" className="avatar-action-btn avatar-remove-btn" onClick={removeAvatar}>
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
            <div className="public-profile-fields">
              <div className="form-group">
                <label htmlFor="readerBio">
                  About you <span className="optional-hint">(optional)</span>
                </label>
                <textarea
                  id="readerBio"
                  value={readerBio}
                  maxLength={BIO_LIMIT}
                  rows={3}
                  placeholder="What kinds of stories or worlds do you love?"
                  onChange={(e) => { setReaderBio(e.target.value); if (bioError) setBioError(null); }}
                />
                <div className="bio-meta"><span className="bio-counter">{readerBio.length} / 500</span></div>
              </div>
              <div className="form-group role-bio-group">
                <label htmlFor="worldbuilderBio">
                  Worldbuilder bio <span className="role-tag">✦ Worldbuilder</span>
                </label>
                <p className="role-bio-hint">Shown on your public worldbuilder page.</p>
                <textarea
                  id="worldbuilderBio"
                  value={worldbuilderBio}
                  maxLength={BIO_LIMIT}
                  rows={3}
                  placeholder="What kinds of worlds do you build?"
                  onChange={(e) => setWorldbuilderBio(e.target.value)}
                />
                <div className="bio-meta"><span className="bio-counter">{worldbuilderBio.length} / 500</span></div>
              </div>
              <div className="form-group role-bio-group">
                <label htmlFor="authorBio">
                  Author bio <span className="role-tag">✦ Author</span>
                </label>
                <p className="role-bio-hint">Shown on your public author page.</p>
                <textarea
                  id="authorBio"
                  value={authorBio}
                  maxLength={BIO_LIMIT}
                  rows={3}
                  placeholder="What kinds of stories do you tell?"
                  onChange={(e) => setAuthorBio(e.target.value)}
                />
                <div className="bio-meta"><span className="bio-counter">{authorBio.length} / 500</span></div>
              </div>
              <button type="button" className="save-btn" disabled={!anyDirty} onClick={handleSave}>
                Save Profile
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
