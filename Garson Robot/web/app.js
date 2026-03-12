/* ══════════════════════════════════════════════════════
   GARSON ROBOT — Web UI (Eel Client)
   app.js — UI mantığı + Eel bridge
   ══════════════════════════════════════════════════════ */

// ── State ────────────────────────────────────────────
let currentLang = null;
let translations = {};
let cart = {};
let isListening = false;

// ── Helpers ──────────────────────────────────────────
function $(id) {
  return document.getElementById(id);
}

function t(key) {
  return translations[key] || key;
}

function showToast(msg, type = "info", duration = 3000) {
  const toast = $("toast");
  const tmsg = $("toast-msg");
  tmsg.textContent = msg;
  toast.className = "toast visible " + type;
  setTimeout(() => {
    toast.className = "toast hidden";
  }, duration);
}

function switchScreen(screenId) {
  document
    .querySelectorAll(".screen")
    .forEach((s) => s.classList.remove("active"));
  $(screenId).classList.add("active");
}

// ══════════════════════════════════════════════════════
//  LANGUAGE SELECTION
// ══════════════════════════════════════════════════════
async function selectLanguage(langCode) {
  currentLang = langCode;
  try {
    await eel.set_language(langCode)();
    translations = await eel.get_translations()();
    updateUITexts();
    await loadMenu();
    const cartData = await eel.get_cart()();
    cart = cartData.items || {};
    renderCart(cartData);
    switchScreen("app-screen");
  } catch (e) {
    console.error("Language set error:", e);
    showToast("Bağlantı hatası!", "error");
  }
}

function updateUITexts() {
  $("header-title").textContent = t("header_title");
  $("header-sub").textContent = t("header_sub");
  $("status-text").textContent = t("status_ready");
  $("cart-title").textContent = t("cart_title");
  $("voice-btn-text").textContent = t("voice_btn");
  $("checkout-btn-text").textContent = t("pay_btn");
  $("total-label").textContent = currentLang === "EN" ? "Total" : "Toplam";
}

function goHome() {
  switchScreen("home-screen");
}

// ══════════════════════════════════════════════════════
//  MENU
// ══════════════════════════════════════════════════════
async function loadMenu() {
  const grid = $("menu-grid");
  grid.innerHTML = "";
  try {
    const items = await eel.get_menu()();
    items.forEach((item, idx) => {
      const card = createProductCard(item, idx);
      grid.appendChild(card);
    });
  } catch (e) {
    console.error("Menu load error:", e);
    showToast("Menü yüklenemedi!", "error");
  }
}

function createProductCard(item, idx) {
  const card = document.createElement("div");
  card.className = "product-card" + (item.stock <= 0 ? " out-of-stock" : "");
  card.style.animationDelay = `${idx * 0.06}s`;

  // Image
  let imgHTML;
  if (item.hasImage) {
    imgHTML = `<img class="product-img" src="/img/${encodeURIComponent(item.imageName)}" alt="${item.name}" loading="lazy" />`;
  } else {
    imgHTML = `<div class="product-img-placeholder">${item.name.substring(0, 2).toUpperCase()}</div>`;
  }

  const currency = t("currency");
  card.innerHTML = `
        ${imgHTML}
        <div class="product-info">
            <div class="product-name">${item.name}</div>
            <div class="product-price">${item.price} ${currency}</div>
        </div>
        ${
          item.stock > 0
            ? `<button class="product-fab" onclick="addToCart('${item.name.replace(/'/g, "\\'")}', ${item.price}, ${item.id})" title="Ekle">
                 <span class="material-symbols-rounded">add</span>
               </button>`
            : `<div class="out-of-stock-badge">${t("no_stock")}</div>`
        }
    `;

  return card;
}

// ══════════════════════════════════════════════════════
//  CART
// ══════════════════════════════════════════════════════
async function addToCart(name, price, id) {
  try {
    const res = await eel.add_to_cart(name, price, id, 1)();
    if (res.success) {
      cart = res.cart.items;
      renderCart(res.cart);
      showToast(`${name} ${t("added")}`, "success", 1500);
    } else {
      if (res.reason === "no_table") {
        const msg = t("qr_scan_prompt") || "Önce masadaki karekodu okutmalısınız.";
        showToast(msg, "warning");
      } else {
        showToast(`${name} ${t("no_stock")}`, "warning");
      }
    }
  } catch (e) {
    console.error("Add to cart error:", e);
  }
}

async function updateCartQty(name, newQty) {
  try {
    const res = await eel.update_cart_item(name, newQty)();
    cart = res.items;
    renderCart(res);
  } catch (e) {
    console.error("Update cart error:", e);
  }
}

async function removeCartItem(name) {
  try {
    const res = await eel.remove_from_cart(name)();
    cart = res.items;
    renderCart(res);
  } catch (e) {
    console.error("Remove cart error:", e);
  }
}

function renderCart(cartData) {
  const container = $("cart-items");
  const emptyEl = $("cart-empty");
  const items = cartData.items || {};
  const total = cartData.total || 0;
  const tableNo = cartData.tableNo || "QR Okutun";

  // Table label
  const tablePrefix = currentLang === "EN" ? "Table No" : "Masa No";
  $("table-label").textContent = `${tablePrefix}: ${tableNo}`;

  // Clear items (keep empty state element)
  container.querySelectorAll(".cart-item").forEach((el) => el.remove());

  const keys = Object.keys(items);
  if (keys.length === 0) {
    emptyEl.style.display = "flex";
  } else {
    emptyEl.style.display = "none";
    keys.forEach((name) => {
      const v = items[name];
      const row = document.createElement("div");
      row.className = "cart-item";
      row.innerHTML = `
                <div class="cart-item-qty">${v.adet}x</div>
                <div class="cart-item-details">
                    <div class="cart-item-name">${name}</div>
                    <div class="cart-item-price">${(v.fiyat * v.adet).toFixed(2)} ${t("currency")}</div>
                </div>
                <div class="cart-item-actions">
                    <button class="cart-act-btn minus" onclick="updateCartQty('${name.replace(/'/g, "\\'")}', ${v.adet - 1})">−</button>
                    <button class="cart-act-btn plus"  onclick="updateCartQty('${name.replace(/'/g, "\\'")}', ${v.adet + 1})">+</button>
                </div>
            `;
      container.appendChild(row);
    });
  }

  $("total-amount").textContent = `${total.toFixed(2)} ${t("currency")}`;
}

// ══════════════════════════════════════════════════════
//  VOICE ORDER
// ══════════════════════════════════════════════════════
async function startVoiceOrder() {
  if (isListening) return;
  isListening = true;

  const btn = $("btn-voice");
  btn.classList.add("listening");
  btn.disabled = true;
  $("voice-btn-text").textContent = t("listening");

  const badge = $("status-badge");
  badge.classList.add("listening");

  try {
    await eel.start_voice_order()();
  } catch (e) {
    console.error("Voice order error:", e);
    resetVoiceButton();
  }
}

function resetVoiceButton() {
  isListening = false;
  const btn = $("btn-voice");
  btn.classList.remove("listening");
  btn.disabled = false;
  $("voice-btn-text").textContent = t("voice_btn");

  const badge = $("status-badge");
  badge.classList.remove("listening");
  badge.classList.remove("alert");
  $("status-text").textContent = t("status_ready");
  $("status-badge").querySelector(".status-icon").textContent = "check_circle";
}

// ══════════════════════════════════════════════════════
//  CHECKOUT
// ══════════════════════════════════════════════════════
async function doCheckout() {
  try {
    await eel.checkout("")();
  } catch (e) {
    console.error("Checkout error:", e);
    showToast("Sipariş gönderilemedi!", "error");
  }
}

// ══════════════════════════════════════════════════════
//  EEL CALLBACKS  (Python → JS)
// ══════════════════════════════════════════════════════

// Durum güncelleme (STT aşaması)
eel.expose(updateStatus);
function updateStatus(msg) {
  $("status-text").textContent = msg;
  $("status-badge").querySelector(".status-icon").textContent = "hearing";
}

// Sesli sipariş tamamlandı
eel.expose(voiceOrderDone);
function voiceOrderDone(cartData) {
  resetVoiceButton();
  if (cartData) {
    cart = cartData.items;
    renderCart(cartData);
  }
}

// Sipariş onaylandı
eel.expose(orderComplete);
function orderComplete(success, totalStr) {
  resetVoiceButton();
  if (success) {
    showToast(
      `✅ ${t("order_confirmed_msg")} (${totalStr} ${t("currency")})`,
      "success",
      4000,
    );
    // Sepeti temizle
    cart = {};
    renderCart({
      items: {},
      total: 0,
      tableNo: $("table-label").textContent.split(": ")[1] || "QR Okutun",
    });
    // Ana ekrana dön
    setTimeout(() => switchScreen("home-screen"), 4000);
  } else {
    showToast("❌ Sipariş gönderilemedi!", "error");
  }
}

// Masa numarası değişti (QR)
eel.expose(tableChanged);
function tableChanged(tableNo) {
  const prefix = currentLang === "EN" ? "Table No" : "Masa No";
  $("table-label").textContent = `${prefix}: ${tableNo}`;
  showToast(
    `📷 ${currentLang === "EN" ? "Table" : "Masa"} ${tableNo}`,
    "success",
    2000,
  );
}

// Masa çağrısı
eel.expose(tableCalling);
function tableCalling(tableId, msg) {
  const badge = $("status-badge");
  badge.classList.add("alert");
  $("status-text").textContent = `🚨 ${msg}`;
  $("status-badge").querySelector(".status-icon").textContent =
    "notifications_active";
  showToast(msg, "warning", 5000);

  // 5 saniye sonra normal duruma dön
  setTimeout(() => {
    badge.classList.remove("alert");
    $("status-text").textContent = t("status_ready");
    $("status-badge").querySelector(".status-icon").textContent =
      "check_circle";
  }, 5000);
}
