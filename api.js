// ============================================================
// api.js — DeviceGuard Frontend Connector
// TechLink Nigeria
// 
// HOW TO USE:
// 1. Put this file in the same folder as your HTML files
// 2. Add this to the <head> of every HTML page:
//    <script src="api.js"></script>
// 3. Replace YOUR_REPLIT_URL below with your actual Replit URL
// ============================================================

const API_BASE = "https://YOUR_REPLIT_URL_HERE"; // ← CHANGE THIS ONE LINE

// ── Core fetch helper ─────────────────────────────────────
// All API calls go through here
async function _call(method, path, body) {
    try {
        const options = {
            method: method,
            headers: { "Content-Type": "application/json" },
        };
        if (body) options.body = JSON.stringify(body);

        const res = await fetch(API_BASE + path, options);
        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || "Something went wrong");
        }
        return data;

    } catch (err) {
        // If fetch fails completely (no internet / server down)
        // fall back to localStorage so the app still works offline
        console.warn("[DeviceGuard API] Offline — using localStorage:", err.message);
        return null; // caller handles null = use localStorage
    }
}

// ============================================================
// AUTH
// ============================================================

/**
 * Send OTP to start registration
 * Call this when user fills in shop details and taps Continue
 */
async function sendRegisterOTP({ shopName, shopAddress, shopPhone, phone1, phone2 }) {
    const result = await _call("POST", "/auth/register", {
        shopName, shopAddress, shopPhone, phone1, phone2
    });
    if (!result) throw new Error("No internet connection");
    return result;
}

/**
 * Confirm OTP and set PIN to complete registration
 * Call this after user enters OTP and chosen PIN
 */
async function confirmRegister({ shopName, shopAddress, shopPhone, phone1, phone2, otp, pin }) {
    const result = await _call("POST", "/auth/register", {
        shopName, shopAddress, shopPhone, phone1, phone2, otp, pin
    });
    if (!result) throw new Error("No internet connection");
    return result;
}

/**
 * Sign in — phone number + PIN
 * Returns shop details to store in localStorage
 */
async function login(phone, pin) {
    const result = await _call("POST", "/auth/login", { phone, pin });
    if (!result) {
        // Offline fallback — check localStorage accounts
        const accounts = JSON.parse(localStorage.getItem("dg_v3_accounts") || "[]");
        const found = accounts.find(a =>
        (a.phone1.replace(/\D/g, "") === phone.replace(/\D/g, "") ||
            a.phone2.replace(/\D/g, "") === phone.replace(/\D/g, ""))
        );
        if (!found) throw new Error("No account found for this number");
        // Verify PIN (hashed check not possible offline — compare raw for dev)
        if (found.pin !== pin) throw new Error("Wrong PIN");
        return found;
    }
    if (!result.success) throw new Error(result.error);

    // Save to localStorage so app works after login
    localStorage.setItem("dg_shopId", result.shopId);
    localStorage.setItem("dg_shopName", result.shopName);
    localStorage.setItem("dg_shopAddress", result.shopAddress);
    localStorage.setItem("dg_shopPhone", result.shopPhone);
    return result;
}

/**
 * Send OTP to reset forgotten PIN
 */
async function forgotPinSendOTP(phone) {
    const result = await _call("POST", "/auth/forgot-pin/send", { phone });
    if (!result) throw new Error("No internet connection");
    return result;
}

/**
 * Reset PIN after verifying OTP
 */
async function forgotPinReset(phone, otp, newPin) {
    const result = await _call("POST", "/auth/forgot-pin/reset", { phone, otp, newPin });
    if (!result) throw new Error("No internet connection");
    return result;
}

// ============================================================
// SALES
// ============================================================

/**
 * Record a new sale
 * shopId is auto-read from localStorage
 */
async function createSale({ brand, model, colour, imei, price, guarantee, buyer, phone, address, paid }) {
    const shopId = localStorage.getItem("dg_shopId");
    if (!shopId) throw new Error("Not logged in");

    const result = await _call("POST", "/sales", {
        shopId, brand, model, colour, imei, price, guarantee, buyer, phone, address, paid
    });

    if (!result) {
        // Offline — save to localStorage as before
        return null;
    }
    return result.sale;
}

/**
 * Get all sales for the logged-in shop
 */
async function getShopSales(filter) {
    const shopId = localStorage.getItem("dg_shopId");
    if (!shopId) return [];

    const result = await _call("GET", `/sales?shopId=${shopId}`);
    if (!result) {
        // Offline fallback
        return JSON.parse(localStorage.getItem("dg_v3_sales") || "[]")
            .filter(s => s.shopId === shopId || s.shop === localStorage.getItem("dg_shopName"));
    }
    return result.sales || [];
}

/**
 * Get a single sale by ID
 */
async function getSale(id) {
    const result = await _call("GET", `/sales/${id}`);
    if (!result) {
        const all = JSON.parse(localStorage.getItem("dg_v3_sales") || "[]");
        return all.find(s => s.id === id) || null;
    }
    return result.sale;
}

/**
 * Get ALL sales — association use only
 */
async function getAllSales(shopId) {
    const path = shopId ? `/sales/all/association?shopId=${shopId}` : "/sales/all/association";
    const result = await _call("GET", path);
    if (!result) return JSON.parse(localStorage.getItem("dg_v3_sales") || "[]");
    return result.sales || [];
}

// ============================================================
// STOCK BOOK
// ============================================================

/**
 * Add a device to the stock book
 */
async function addStock({ device, storage, colour, imei, buyPrice, sellPrice, source }) {
    const shopId = localStorage.getItem("dg_shopId");
    if (!shopId) throw new Error("Not logged in");

    const result = await _call("POST", "/stock", {
        shopId, device, storage, colour, imei, buyPrice, sellPrice, source
    });
    if (!result) return null;
    return result.entry;
}

/**
 * Get stock book for logged-in shop
 * filter: "all" | "sold" | "unsold"
 */
async function getStock(filter = "all") {
    const shopId = localStorage.getItem("dg_shopId");
    if (!shopId) return [];

    const result = await _call("GET", `/stock?shopId=${shopId}&filter=${filter}`);
    if (!result) {
        return JSON.parse(localStorage.getItem("dg_v3_stock") || "[]")
            .filter(s => s.shopId === shopId || s.shop === localStorage.getItem("dg_shopName"));
    }
    return result.stock || [];
}

/**
 * Get ALL stock — association purchase records
 */
async function getAllStock(shopId) {
    const path = shopId ? `/stock/all/association?shopId=${shopId}` : "/stock/all/association";
    const result = await _call("GET", path);
    if (!result) return JSON.parse(localStorage.getItem("dg_v3_stock") || "[]");
    return result.stock || [];
}

/**
 * Mark a stock item as sold
 */
async function markStockSold(stockId, soldPrice) {
    const result = await _call("PATCH", `/stock/${stockId}/sold`, { soldPrice });
    if (!result) return null;
    return result;
}

/**
 * Delete a stock item
 */
async function deleteStock(stockId) {
    const result = await _call("DELETE", `/stock/${stockId}`);
    if (!result) return null;
    return result;
}

// ============================================================
// STOLEN DEVICES
// ============================================================

/**
 * Submit a stolen device report — association use
 */
async function submitStolenReport({ imei, device, reporter, notes, type }) {
    const result = await _call("POST", "/stolen", { imei, device, reporter, notes, type });
    if (!result) return null;
    return result.report;
}

/**
 * Get all stolen reports — association use
 * status: "all" | "reported" | "review" | "confirmed" | "rejected"
 */
async function getStolenReports(status = "all", q = "") {
    const result = await _call("GET", `/stolen?status=${status}&q=${encodeURIComponent(q)}`);
    if (!result) return JSON.parse(localStorage.getItem("dg_v3_flags") || "[]");
    return result.reports || [];
}

/**
 * Update report status — association use
 * status: "review" | "confirmed" | "rejected"
 */
async function updateStolenStatus(reportId, status) {
    const result = await _call("PATCH", `/stolen/${reportId}/status`, { status });
    if (!result) return null;
    return result;
}

/**
 * Add internal note to a report — association use
 */
async function addStolenNote(reportId, note) {
    const result = await _call("POST", `/stolen/${reportId}/note`, { note });
    if (!result) return null;
    return result;
}

/**
 * Check if an IMEI is flagged stolen
 * Use this BEFORE recording any sale
 */
async function checkIMEI(imei) {
    const result = await _call("GET", `/stolen/check/${imei}`);
    if (!result) {
        // Offline fallback
        const flags = JSON.parse(localStorage.getItem("dg_v3_flags") || "[]");
        const found = flags.find(f =>
            f.imei && f.imei.replace(/\D/g, "") === imei.replace(/\D/g, "") &&
            f.status === "confirmed"
        );
        return found ? { flagged: true, device: found.device, flaggedBy: found.flaggedBy } : { flagged: false };
    }
    return result;
}

// ============================================================
// CUSTOMER REGISTRY
// ============================================================

/**
 * Register a device — customer self-registration
 */
async function registerDevice({ device, imei, colour, storage, shop, name, phone, address }) {
    const result = await _call("POST", "/registry", {
        device, imei, colour, storage, shop, name, phone, address
    });
    if (!result) return null;
    return result.registration;
}

/**
 * Check a device by Record ID or IMEI
 * Used on customer check page AND seller flag checker
 * Returns: { found, stolen, record?, flaggedBy?, confirmedDate? }
 */
async function checkDevice(query) {
    const result = await _call("GET", `/registry/check/${encodeURIComponent(query)}`);
    if (!result) {
        // Offline fallback — check localStorage
        const flags = JSON.parse(localStorage.getItem("dg_v3_flags") || "[]");
        const sales = JSON.parse(localStorage.getItem("dg_v3_sales") || "[]");
        const custs = JSON.parse(localStorage.getItem("dg_v3_cust_reg") || "[]");
        const q = query.toLowerCase();

        const stolen = flags.find(f =>
            f.imei && f.imei.replace(/\D/g, "") === q.replace(/\D/g, "") && f.status === "confirmed"
        );
        if (stolen) return { found: false, stolen: true, ...stolen };

        const rec = [...sales, ...custs].find(r =>
            r.id.toLowerCase() === q ||
            (r.imei && r.imei.replace(/\D/g, "").includes(q.replace(/\D/g, "")))
        );
        if (rec) {
            return {
                found: true, stolen: false,
                record: {
                    id: rec.id,
                    device: rec.brand ? `${rec.brand} ${rec.model}` : rec.device,
                    imei: rec.imei,
                    colour: rec.colour,
                    owner: rec.buyer || rec.name,
                    phone: rec.phone,
                    shop: rec.shop || rec.shopName,
                    dateStr: rec.dateStr,
                }
            };
        }
        return { found: false, stolen: false };
    }
    return result;
}

/**
 * Get all customer registrations — association use
 */
async function getAllRegistrations() {
    const result = await _call("GET", "/registry/all");
    if (!result) return JSON.parse(localStorage.getItem("dg_v3_cust_reg") || "[]");
    return result.registrations || [];
}

// ============================================================
// UTILITY
// ============================================================

/**
 * Check if backend is reachable
 */
async function pingAPI() {
    const result = await _call("GET", "/");
    return result !== null;
}

/**
 * Get logged-in shop info from localStorage
 */
function getCurrentShop() {
    return {
        shopId: localStorage.getItem("dg_shopId"),
        shopName: localStorage.getItem("dg_shopName"),
        shopAddress: localStorage.getItem("dg_shopAddress"),
        shopPhone: localStorage.getItem("dg_shopPhone"),
    };
}

/**
 * Log out — clears session
 */
function logoutSession() {
    ["dg_shopId", "dg_shopName", "dg_shopAddress", "dg_shopPhone"].forEach(k =>
        localStorage.removeItem(k)
    );
}

// ============================================================
// READY
// ============================================================
console.log("🛡️ DeviceGuard API connector loaded —", API_BASE);