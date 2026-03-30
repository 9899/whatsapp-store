import { useState, useEffect } from "react";
import { auth, db, googleProvider } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, serverTimestamp, setDoc, getDoc
} from "firebase/firestore";
import { uploadImage } from "./cloudinary";
import "./Admin.css";

const TABS = ["Products", "Coupons", "Orders", "Settings"];
const DEFAULT_CATS = ["Clothing","Footwear","Electronics","Accessories","Bags"];

export default function Admin() {
  const [user, setUser]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState(0);
  const [products, setProducts] = useState([]);
  const [coupons, setCoupons]   = useState([]);
  const [orders, setOrders]     = useState([]);
  const [settings, setSettings] = useState({ storeName: "", whatsapp: "", deliveryFee: "49", freeDeliveryAbove: "999" });
  const [toast, setToast]       = useState(null);
  const [modal, setModal]       = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setLoading(false); });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    const u1 = onSnapshot(collection(db, "products"), s => setProducts(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(collection(db, "coupons"),  s => setCoupons(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u3 = onSnapshot(collection(db, "orders"),   s => setOrders(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.createdAt?.seconds - a.createdAt?.seconds)));
    getDoc(doc(db, "settings", "store")).then(d => { if (d.exists()) setSettings(d.data()); });
    return () => { u1(); u2(); u3(); };
  }, [user]);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const login = async () => {
    try { await signInWithPopup(auth, googleProvider); }
    catch (e) { showToast("Login failed: " + e.message, false); }
  };

  const logout = () => signOut(auth);

  const saveSettings = async () => {
    await setDoc(doc(db, "settings", "store"), settings);
    showToast("Settings saved!");
  };

  if (loading) return <div className="admin-center"><div className="spinner"/></div>;

  if (!user) return (
    <div className="admin-center">
      <div className="login-card">
        <div style={{ fontSize: 48, marginBottom: 16 }}>🛒</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Order Store CRM</h1>
        <p style={{ color: "#888", marginBottom: 28, fontSize: 14 }}>Sign in to manage your store</p>
        <button className="google-btn" onClick={login}>
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-3.59-13.46-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Continue with Google
        </button>
      </div>
    </div>
  );

  return (
    <div className="admin-wrap">
      {toast && <div className={`admin-toast${toast.ok ? "" : " err"}`}>{toast.msg}</div>}
      {modal && <Modal modal={modal} setModal={setModal} showToast={showToast} products={products} />}

      <aside className="sidebar">
        <div className="sidebar-logo">🛒 CRM</div>
        <nav>
          {TABS.map((t, i) => (
            <button key={t} className={`side-item${tab === i ? " active" : ""}`} onClick={() => setTab(i)}>
              {["📦","🏷️","📋","⚙️"][i]} {t}
            </button>
          ))}
        </nav>
        <div className="sidebar-user">
          <img src={user.photoURL} alt="" className="avatar" />
          <div>
            <p className="uname">{user.displayName?.split(" ")[0]}</p>
            <button className="logout-btn" onClick={logout}>Sign out</button>
          </div>
        </div>
      </aside>

      <main className="admin-main">

        {/* ── PRODUCTS ── */}
        {tab === 0 && (
          <div>
            <div className="page-header">
              <h2>Products <span className="count">{products.length}</span></h2>
              <button className="btn-primary" onClick={() => setModal({ type: "product", data: null })}>+ Add Product</button>
            </div>
            <div className="product-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Image</th><th>Name</th><th>Price</th><th>Original</th><th>Stock</th><th>Category</th><th>Tag</th><th>Actions</th></tr></thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id}>
                      <td>
                        {p.image
                          ? <img src={p.image} alt="" className="table-img" />
                          : <div className="table-img" style={{ display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, background:"#f5f5f5" }}>{p.emoji}</div>
                        }
                      </td>
                      <td><strong>{p.name}</strong></td>
                      <td>Rs.{p.price?.toLocaleString()}</td>
                      <td>{p.originalPrice ? `Rs.${p.originalPrice?.toLocaleString()}` : "—"}</td>
                      <td><span className={`stock-badge${p.stock <= 3 ? " low" : ""}`}>{p.stock}</span></td>
                      <td>{p.category}</td>
                      <td><span className="tag-pill">{p.tag}</span></td>
                      <td>
                        <button className="tbl-btn edit" onClick={() => setModal({ type: "product", data: p })}>Edit</button>
                        <button className="tbl-btn del" onClick={async () => { await deleteDoc(doc(db, "products", p.id)); showToast("Product deleted"); }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {products.length === 0 && <div className="empty-msg">No products yet. Click "+ Add Product" to start.</div>}
            </div>
          </div>
        )}

        {/* ── COUPONS ── */}
        {tab === 1 && (
          <div>
            <div className="page-header">
              <h2>Coupons <span className="count">{coupons.length}</span></h2>
              <button className="btn-primary" onClick={() => setModal({ type: "coupon", data: null })}>+ Add Coupon</button>
            </div>
            <div className="product-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Min Order</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {coupons.map(c => (
                    <tr key={c.id}>
                      <td><strong style={{ fontFamily: "monospace", fontSize: 15 }}>{c.code}</strong></td>
                      <td>{c.type === "percent" ? "Percentage" : "Flat"}</td>
                      <td>{c.type === "percent" ? `${c.value}%` : `Rs.${c.value}`}</td>
                      <td>{c.minOrder ? `Rs.${c.minOrder}` : "None"}</td>
                      <td><span className={`status-pill${c.active ? " active" : " inactive"}`}>{c.active ? "Active" : "Inactive"}</span></td>
                      <td>
                        <button className="tbl-btn edit" onClick={() => setModal({ type: "coupon", data: c })}>Edit</button>
                        <button className="tbl-btn del" onClick={async () => { await deleteDoc(doc(db, "coupons", c.id)); showToast("Coupon deleted"); }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {coupons.length === 0 && <div className="empty-msg">No coupons yet. Click "+ Add Coupon" to start.</div>}
            </div>
          </div>
        )}

        {/* ── ORDERS ── */}
        {tab === 2 && (
          <div>
            <div className="page-header">
              <h2>Orders <span className="count">{orders.length}</span></h2>
            </div>
            {orders.length === 0 && <div className="empty-msg">No orders yet.</div>}
            {orders.map(o => (
              <div key={o.id} className="order-card">
                <div className="order-header">
                  <div>
                    <p className="order-name">{o.customerName}</p>
                    <p className="order-meta">📞 {o.phone} · 📍 {o.address}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p className="order-total">Rs.{o.total?.toLocaleString()}</p>
                    <p className="order-date">{o.createdAt?.toDate?.()?.toLocaleDateString("en-IN") || "—"}</p>
                  </div>
                </div>
                <div className="order-items">
                  {o.items?.map((item, i) => (
                    <span key={i} className="order-item-pill">{item.emoji} {item.name} ×{item.qty}</span>
                  ))}
                </div>
                <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                  <select className="status-select" value={o.status || "pending"}
                    onChange={async e => { await updateDoc(doc(db, "orders", o.id), { status: e.target.value }); showToast("Status updated"); }}>
                    <option value="pending">⏳ Pending</option>
                    <option value="confirmed">✅ Confirmed</option>
                    <option value="shipped">🚚 Shipped</option>
                    <option value="delivered">📦 Delivered</option>
                    <option value="cancelled">❌ Cancelled</option>
                  </select>
                  <button className="tbl-btn del" onClick={async () => { await deleteDoc(doc(db, "orders", o.id)); showToast("Order deleted"); }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── SETTINGS ── */}
        {tab === 3 && (
          <div>
            <div className="page-header"><h2>Store Settings</h2></div>
            <div className="settings-card">
              {[
                { label: "Store Name",               key: "storeName",         ph: "e.g. My Fashion Store" },
                { label: "WhatsApp Number",           key: "whatsapp",          ph: "e.g. 919899563148" },
                { label: "Delivery Fee (Rs.)",        key: "deliveryFee",       ph: "e.g. 49" },
                { label: "Free Delivery Above (Rs.)", key: "freeDeliveryAbove", ph: "e.g. 999" },
              ].map(({ label, key, ph }) => (
                <div key={key} className="field">
                  <label>{label}</label>
                  <input placeholder={ph} value={settings[key] || ""}
                    onChange={e => setSettings({ ...settings, [key]: e.target.value })} />
                </div>
              ))}
              <button className="btn-primary" onClick={saveSettings}>💾 Save Settings</button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

/* ── MODAL ── */
function Modal({ modal, setModal, showToast, products }) {
  const isProduct = modal.type === "product";
  const editing   = !!modal.data;

  const existingCats = [...new Set(products.map(p => p.category).filter(Boolean))];
  const allCats = [...new Set([...DEFAULT_CATS, ...existingCats])];

  const [form, setForm] = useState(modal.data || (isProduct ? {
    name: "", price: "", originalPrice: "", stock: "", category: "Clothing",
    tag: "New Arrival", emoji: "🛍️", image: "", imageUrl: "",
  } : {
    code: "", type: "percent", value: "", minOrder: "", active: true,
  }));

  const [uploading, setUploading] = useState(false);
  const [imgPreview, setImgPreview] = useState(modal.data?.image || "");
  const [customCat, setCustomCat] = useState(
    modal.data?.category ? !DEFAULT_CATS.includes(modal.data.category) : false
  );
  const [newCat, setNewCat] = useState(
    modal.data?.category && !DEFAULT_CATS.includes(modal.data.category) ? modal.data.category : ""
  );

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleImageFile = async e => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      set("image", url); setImgPreview(url);
      showToast("Image uploaded!");
    } catch { showToast("Image upload failed", false); }
    finally { setUploading(false); }
  };

  const handleImageUrl = e => {
    set("imageUrl", e.target.value);
    set("image", e.target.value);
    setImgPreview(e.target.value);
  };

  const save = async () => {
    if (isProduct) {
      if (!form.name || !form.price) { showToast("Name and price required", false); return; }
      const finalCat = customCat ? newCat.trim() : form.category;
      if (!finalCat) { showToast("Please enter a category", false); return; }
      const data = {
        name: form.name,
        price: Number(form.price),
        originalPrice: form.originalPrice ? Number(form.originalPrice) : null,
        stock: Number(form.stock) || 0,
        category: finalCat,
        tag: form.tag,
        emoji: form.emoji,
        image: form.image || "",
      };
      if (editing) await updateDoc(doc(db, "products", form.id), data);
      else await addDoc(collection(db, "products"), { ...data, createdAt: serverTimestamp() });
      showToast(editing ? "Product updated!" : "Product added!");
    } else {
      if (!form.code || !form.value) { showToast("Code and value required", false); return; }
      const data = {
        code: form.code.toUpperCase(),
        type: form.type,
        value: Number(form.value),
        minOrder: Number(form.minOrder) || 0,
        active: form.active,
      };
      if (editing) await updateDoc(doc(db, "coupons", form.id), data);
      else await addDoc(collection(db, "coupons"), { ...data, createdAt: serverTimestamp() });
      showToast(editing ? "Coupon updated!" : "Coupon added!");
    }
    setModal(null);
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
      <div className="modal-box">
        <div className="modal-header">
          <h3>{editing ? "Edit" : "Add"} {isProduct ? "Product" : "Coupon"}</h3>
          <button className="modal-close" onClick={() => setModal(null)}>✕</button>
        </div>

        {isProduct ? (
          <div className="modal-body">
            {/* Image */}
            <div className="field">
              <label>Product Image</label>
              <div className="img-upload-row">
                {imgPreview && <img src={imgPreview} alt="" className="img-preview" />}
                <div style={{ flex: 1 }}>
                  <input type="file" accept="image/*" onChange={handleImageFile} className="file-input" />
                  <p className="or-divider">— or paste URL —</p>
                  <input placeholder="https://..." value={form.imageUrl || ""} onChange={handleImageUrl} />
                </div>
              </div>
              {uploading && <p style={{ fontSize: 12, color: "#888", marginTop: 4 }}>⏳ Uploading...</p>}
            </div>

            {/* Emoji + Name */}
            <div className="field-row">
              <div className="field" style={{ flex: 1 }}>
                <label>Emoji</label>
                <input value={form.emoji} onChange={e => set("emoji", e.target.value)} style={{ fontSize: 22 }} />
              </div>
              <div className="field" style={{ flex: 3 }}>
                <label>Product Name *</label>
                <input placeholder="e.g. Classic T-Shirt" value={form.name} onChange={e => set("name", e.target.value)} />
              </div>
            </div>

            {/* Price + Original + Stock */}
            <div className="field-row">
              <div className="field">
                <label>Price (Rs.) *</label>
                <input type="number" placeholder="499" value={form.price} onChange={e => set("price", e.target.value)} />
              </div>
              <div className="field">
                <label>Original Price</label>
                <input type="number" placeholder="699" value={form.originalPrice || ""} onChange={e => set("originalPrice", e.target.value)} />
              </div>
              <div className="field">
                <label>Stock</label>
                <input type="number" placeholder="10" value={form.stock} onChange={e => set("stock", e.target.value)} />
              </div>
            </div>

            {/* Category + Tag */}
            <div className="field-row">
              <div className="field">
                <label>Category</label>
                <select
                  value={customCat ? "__custom__" : form.category}
                  onChange={e => {
                    if (e.target.value === "__custom__") {
                      setCustomCat(true);
                      set("category", "");
                    } else {
                      setCustomCat(false);
                      setNewCat("");
                      set("category", e.target.value);
                    }
                  }}>
                  {allCats.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="__custom__">＋ Add New Category...</option>
                </select>
                {customCat && (
                  <input
                    placeholder="e.g. Jewellery"
                    value={newCat}
                    onChange={e => setNewCat(e.target.value)}
                    style={{ marginTop: 8 }}
                  />
                )}
              </div>
              <div className="field">
                <label>Tag</label>
                <select value={form.tag} onChange={e => set("tag", e.target.value)}>
                  {["New Arrival","Sale","Trending","Popular","Limited","Bestseller"].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </div>
        ) : (
          <div className="modal-body">
            <div className="field">
              <label>Coupon Code *</label>
              <input placeholder="e.g. SAVE10" value={form.code}
                onChange={e => set("code", e.target.value.toUpperCase())}
                style={{ fontFamily: "monospace", fontSize: 16, letterSpacing: 2 }} />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Discount Type</label>
                <select value={form.type} onChange={e => set("type", e.target.value)}>
                  <option value="percent">Percentage (%)</option>
                  <option value="flat">Flat Amount (Rs.)</option>
                </select>
              </div>
              <div className="field">
                <label>Value *</label>
                <input type="number" placeholder={form.type === "percent" ? "10" : "200"} value={form.value} onChange={e => set("value", e.target.value)} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Min Order (Rs.)</label>
                <input type="number" placeholder="0" value={form.minOrder || ""} onChange={e => set("minOrder", e.target.value)} />
              </div>
              <div className="field">
                <label>Status</label>
                <select value={form.active ? "true" : "false"} onChange={e => set("active", e.target.value === "true")}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="modal-footer">
          <button className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
          <button className="btn-primary" onClick={save}>{editing ? "Save Changes" : "Add"}</button>
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const [user, setUser]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState(0);
  const [products, setProducts] = useState([]);
  const [coupons, setCoupons]   = useState([]);
  const [orders, setOrders]     = useState([]);
  const [settings, setSettings] = useState({ storeName: "", whatsapp: "", deliveryFee: "49", freeDeliveryAbove: "999" });
  const [toast, setToast]       = useState(null);
  const [modal, setModal]       = useState(null); // {type: 'product'|'coupon', data}

  // Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setLoading(false); });
    return unsub;
  }, []);

  // Firestore listeners
  useEffect(() => {
    if (!user) return;
    const u1 = onSnapshot(collection(db, "products"), s => setProducts(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(collection(db, "coupons"),  s => setCoupons(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u3 = onSnapshot(collection(db, "orders"),   s => setOrders(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.createdAt?.seconds - a.createdAt?.seconds)));
    const u4 = getDoc(doc(db, "settings", "store")).then(d => { if (d.exists()) setSettings(d.data()); });
    return () => { u1(); u2(); u3(); };
  }, [user]);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const login = async () => {
    try { await signInWithPopup(auth, googleProvider); }
    catch (e) { showToast("Login failed: " + e.message, false); }
  };

  const logout = () => signOut(auth);

  // Settings save
  const saveSettings = async () => {
    await setDoc(doc(db, "settings", "store"), settings);
    showToast("Settings saved!");
  };

  // ── LOGIN SCREEN ──
  if (loading) return <div className="admin-center"><div className="spinner"/></div>;

  if (!user) return (
    <div className="admin-center">
      <div className="login-card">
        <div style={{ fontSize: 48, marginBottom: 16 }}>🛒</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Order Store CRM</h1>
        <p style={{ color: "#888", marginBottom: 28, fontSize: 14 }}>Sign in to manage your store</p>
        <button className="google-btn" onClick={login}>
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-3.59-13.46-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Continue with Google
        </button>
      </div>
    </div>
  );

  // ── MAIN CRM ──
  return (
    <div className="admin-wrap">
      {toast && <div className={`admin-toast${toast.ok ? "" : " err"}`}>{toast.msg}</div>}
      {modal && <Modal modal={modal} setModal={setModal} showToast={showToast} />}

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">🛒 CRM</div>
        <nav>
          {TABS.map((t, i) => (
            <button key={t} className={`side-item${tab === i ? " active" : ""}`} onClick={() => setTab(i)}>
              {["📦","🏷️","📋","⚙️"][i]} {t}
            </button>
          ))}
        </nav>
        <div className="sidebar-user">
          <img src={user.photoURL} alt="" className="avatar" />
          <div>
            <p className="uname">{user.displayName?.split(" ")[0]}</p>
            <button className="logout-btn" onClick={logout}>Sign out</button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="admin-main">

        {/* ── PRODUCTS ── */}
        {tab === 0 && (
          <div>
            <div className="page-header">
              <h2>Products <span className="count">{products.length}</span></h2>
              <button className="btn-primary" onClick={() => setModal({ type: "product", data: null })}>+ Add Product</button>
            </div>
            <div className="product-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Image</th><th>Name</th><th>Price</th><th>Original</th><th>Stock</th><th>Category</th><th>Tag</th><th>Actions</th></tr></thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id}>
                      <td><img src={p.image || "https://via.placeholder.com/48"} alt="" className="table-img" /></td>
                      <td><strong>{p.name}</strong></td>
                      <td>Rs.{p.price?.toLocaleString()}</td>
                      <td>{p.originalPrice ? `Rs.${p.originalPrice?.toLocaleString()}` : "—"}</td>
                      <td><span className={`stock-badge${p.stock <= 3 ? " low" : ""}`}>{p.stock}</span></td>
                      <td>{p.category}</td>
                      <td><span className="tag-pill">{p.tag}</span></td>
                      <td>
                        <button className="tbl-btn edit" onClick={() => setModal({ type: "product", data: p })}>Edit</button>
                        <button className="tbl-btn del" onClick={async () => { await deleteDoc(doc(db, "products", p.id)); showToast("Product deleted"); }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {products.length === 0 && <div className="empty-msg">No products yet. Click "+ Add Product" to start.</div>}
            </div>
          </div>
        )}

        {/* ── COUPONS ── */}
        {tab === 1 && (
          <div>
            <div className="page-header">
              <h2>Coupons <span className="count">{coupons.length}</span></h2>
              <button className="btn-primary" onClick={() => setModal({ type: "coupon", data: null })}>+ Add Coupon</button>
            </div>
            <div className="product-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Min Order</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {coupons.map(c => (
                    <tr key={c.id}>
                      <td><strong style={{ fontFamily: "monospace", fontSize: 15 }}>{c.code}</strong></td>
                      <td>{c.type === "percent" ? "Percentage" : "Flat"}</td>
                      <td>{c.type === "percent" ? `${c.value}%` : `Rs.${c.value}`}</td>
                      <td>{c.minOrder ? `Rs.${c.minOrder}` : "None"}</td>
                      <td><span className={`status-pill${c.active ? " active" : " inactive"}`}>{c.active ? "Active" : "Inactive"}</span></td>
                      <td>
                        <button className="tbl-btn edit" onClick={() => setModal({ type: "coupon", data: c })}>Edit</button>
                        <button className="tbl-btn del" onClick={async () => { await deleteDoc(doc(db, "coupons", c.id)); showToast("Coupon deleted"); }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {coupons.length === 0 && <div className="empty-msg">No coupons yet. Click "+ Add Coupon" to start.</div>}
            </div>
          </div>
        )}

        {/* ── ORDERS ── */}
        {tab === 2 && (
          <div>
            <div className="page-header">
              <h2>Orders <span className="count">{orders.length}</span></h2>
            </div>
            {orders.length === 0 && <div className="empty-msg">No orders yet. Orders appear here when customers place them.</div>}
            {orders.map(o => (
              <div key={o.id} className="order-card">
                <div className="order-header">
                  <div>
                    <p className="order-name">{o.customerName}</p>
                    <p className="order-meta">📞 {o.phone} · 📍 {o.address}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p className="order-total">Rs.{o.total?.toLocaleString()}</p>
                    <p className="order-date">{o.createdAt?.toDate?.()?.toLocaleDateString("en-IN") || "—"}</p>
                  </div>
                </div>
                <div className="order-items">
                  {o.items?.map((item, i) => (
                    <span key={i} className="order-item-pill">{item.emoji} {item.name} ×{item.qty}</span>
                  ))}
                </div>
                <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                  <select className="status-select" value={o.status || "pending"}
                    onChange={async e => { await updateDoc(doc(db, "orders", o.id), { status: e.target.value }); showToast("Status updated"); }}>
                    <option value="pending">⏳ Pending</option>
                    <option value="confirmed">✅ Confirmed</option>
                    <option value="shipped">🚚 Shipped</option>
                    <option value="delivered">📦 Delivered</option>
                    <option value="cancelled">❌ Cancelled</option>
                  </select>
                  <button className="tbl-btn del" onClick={async () => { await deleteDoc(doc(db, "orders", o.id)); showToast("Order deleted"); }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── SETTINGS ── */}
        {tab === 3 && (
          <div>
            <div className="page-header"><h2>Store Settings</h2></div>
            <div className="settings-card">
              {[
                { label: "Store Name",           key: "storeName",         ph: "e.g. My Fashion Store" },
                { label: "WhatsApp Number",       key: "whatsapp",          ph: "e.g. 919899563148" },
                { label: "Delivery Fee (Rs.)",    key: "deliveryFee",       ph: "e.g. 49" },
                { label: "Free Delivery Above (Rs.)", key: "freeDeliveryAbove", ph: "e.g. 999" },
              ].map(({ label, key, ph }) => (
                <div key={key} className="field">
                  <label>{label}</label>
                  <input placeholder={ph} value={settings[key] || ""}
                    onChange={e => setSettings({ ...settings, [key]: e.target.value })} />
                </div>
              ))}
              <button className="btn-primary" onClick={saveSettings}>💾 Save Settings</button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

/* ── MODAL ── */
function Modal({ modal, setModal, showToast }) {
  const isProduct = modal.type === "product";
  const editing   = !!modal.data;

  const [form, setForm] = useState(modal.data || (isProduct ? {
    name: "", price: "", originalPrice: "", stock: "", category: "Clothing",
    tag: "New Arrival", emoji: "🛍️", image: "", imageUrl: "",
  } : {
    code: "", type: "percent", value: "", minOrder: "", active: true,
  }));
  const [uploading, setUploading] = useState(false);
  const [customCat, setCustomCat] = useState(modal.data?.category && !["Clothing","Footwear","Electronics","Accessories","Bags"].includes(modal.data?.category));
  const [imgPreview, setImgPreview] = useState(modal.data?.image || "");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleImageFile = async e => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      set("image", url); setImgPreview(url);
      showToast("Image uploaded!");
    } catch { showToast("Image upload failed", false); }
    finally { setUploading(false); }
  };

  const handleImageUrl = e => {
    set("imageUrl", e.target.value);
    set("image", e.target.value);
    setImgPreview(e.target.value);
  };

  const save = async () => {
    if (isProduct) {
      if (!form.name || !form.price) { showToast("Name and price required", false); return; }
      const data = {
        name: form.name, price: Number(form.price),
        originalPrice: form.originalPrice ? Number(form.originalPrice) : null,
        stock: Number(form.stock) || 0, category: form.category,
        tag: form.tag, emoji: form.emoji,
        image: form.image || "",
      };
      if (editing) await updateDoc(doc(db, "products", form.id), data);
      else await addDoc(collection(db, "products"), { ...data, createdAt: serverTimestamp() });
      showToast(editing ? "Product updated!" : "Product added!");
    } else {
      if (!form.code || !form.value) { showToast("Code and value required", false); return; }
      const data = {
        code: form.code.toUpperCase(), type: form.type,
        value: Number(form.value), minOrder: Number(form.minOrder) || 0,
        active: form.active,
      };
      if (editing) await updateDoc(doc(db, "coupons", form.id), data);
      else await addDoc(collection(db, "coupons"), { ...data, createdAt: serverTimestamp() });
      showToast(editing ? "Coupon updated!" : "Coupon added!");
    }
    setModal(null);
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
      <div className="modal-box">
        <div className="modal-header">
          <h3>{editing ? "Edit" : "Add"} {isProduct ? "Product" : "Coupon"}</h3>
          <button className="modal-close" onClick={() => setModal(null)}>✕</button>
        </div>

        {isProduct ? (
          <div className="modal-body">
            {/* Image */}
            <div className="field">
              <label>Product Image</label>
              <div className="img-upload-row">
                {imgPreview && <img src={imgPreview} alt="" className="img-preview" />}
                <div style={{ flex: 1 }}>
                  <input type="file" accept="image/*" onChange={handleImageFile} className="file-input" />
                  <p className="or-divider">— or paste URL —</p>
                  <input placeholder="https://..." value={form.imageUrl || ""} onChange={handleImageUrl} />
                </div>
              </div>
              {uploading && <p style={{ fontSize: 12, color: "#888", marginTop: 4 }}>⏳ Uploading...</p>}
            </div>
            <div className="field-row">
              <div className="field">
                <label>Emoji</label>
                <input value={form.emoji} onChange={e => set("emoji", e.target.value)} style={{ fontSize: 22 }} />
              </div>
              <div className="field" style={{ flex: 3 }}>
                <label>Product Name *</label>
                <input placeholder="e.g. Classic T-Shirt" value={form.name} onChange={e => set("name", e.target.value)} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Price (Rs.) *</label>
                <input type="number" placeholder="499" value={form.price} onChange={e => set("price", e.target.value)} />
              </div>
              <div className="field">
                <label>Original Price</label>
                <input type="number" placeholder="699" value={form.originalPrice || ""} onChange={e => set("originalPrice", e.target.value)} />
              </div>
              <div className="field">
                <label>Stock</label>
                <input type="number" placeholder="10" value={form.stock} onChange={e => set("stock", e.target.value)} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Category</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <select value={customCat ? "__custom__" : form.category}
                    onChange={e => { if (e.target.value === "__custom__") { setCustomCat(true); set("category", ""); } else { setCustomCat(false); set("category", e.target.value); } }}
                    style={{ flex: 1 }}>
                    {["Clothing","Footwear","Electronics","Accessories","Bags","__custom__"].map(c =>
                      <option key={c} value={c}>{c === "__custom__" ? "＋ Add New..." : c}</option>
                    )}
                  </select>
                  {customCat && (
                    <input placeholder="e.g. Jewellery" value={form.category}
                      onChange={e => set("category", e.target.value)} style={{ flex: 1 }} />
                  )}
                </div>
              </div>
              <div className="field">
                <label>Tag</label>
                <select value={form.tag} onChange={e => set("tag", e.target.value)}>
                  {["New Arrival","Sale","Trending","Popular","Limited","Bestseller"].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </div>
        ) : (
          <div className="modal-body">
            <div className="field">
              <label>Coupon Code *</label>
              <input placeholder="e.g. SAVE10" value={form.code} onChange={e => set("code", e.target.value.toUpperCase())}
                style={{ fontFamily: "monospace", fontSize: 16, letterSpacing: 2 }} />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Discount Type</label>
                <select value={form.type} onChange={e => set("type", e.target.value)}>
                  <option value="percent">Percentage (%)</option>
                  <option value="flat">Flat Amount (Rs.)</option>
                </select>
              </div>
              <div className="field">
                <label>Value *</label>
                <input type="number" placeholder={form.type === "percent" ? "10" : "200"} value={form.value} onChange={e => set("value", e.target.value)} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Min Order (Rs.)</label>
                <input type="number" placeholder="0" value={form.minOrder || ""} onChange={e => set("minOrder", e.target.value)} />
              </div>
              <div className="field">
                <label>Status</label>
                <select value={form.active ? "true" : "false"} onChange={e => set("active", e.target.value === "true")}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="modal-footer">
          <button className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
          <button className="btn-primary" onClick={save}>{editing ? "Save Changes" : "Add"}</button>
        </div>
      </div>
    </div>
  );
}