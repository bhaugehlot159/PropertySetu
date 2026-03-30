(() => {
  const live = window.PropertySetuLive || {};
  const auctionDiv = document.getElementById("auctionList");
  if (!auctionDiv) return;
  const allowDemoFallback = Boolean(live.allowDemoFallback);

  const readJson = live.readJson || ((key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  });
  const writeJson = live.writeJson || ((key, value) => localStorage.setItem(key, JSON.stringify(value)));
  const formatPrice = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
  const getAnyToken = () => (live.getAnyToken ? live.getAnyToken() : "");
  const escapeHtml = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));

  const LOCAL_BID_KEY = "propertySetu:sealedBids";

  let listings = [];
  let summaryByPropertyId = new Map();
  let winnerByPropertyId = new Map();
  let adminBoardByPropertyId = new Map();

  const buildLocalAuctions = () => {
    const fromLocal = readJson("propertySetu:listings", [])
      .filter((item) => String(item?.city || "Udaipur").toLowerCase().includes("udaipur"))
      .slice(0, 6)
      .map((item, idx) => ({
        id: item.id || `local-auction-${idx + 1}`,
        title: item.title || "Udaipur Property",
        location: item.location || item.locality || "Udaipur",
        price: Number(item.price || 0),
      }));

    if (fromLocal.length) return fromLocal;
    return [];
  };

  const fetchLiveAuctions = async () => {
    if (!live.request) return buildLocalAuctions();
    try {
      const response = await live.request("/properties?city=Udaipur");
      const items = (response?.items || []).slice(0, 20).map((item) => ({
        id: item.id,
        title: item.title || "Udaipur Property",
        location: item.location || "Udaipur",
        price: Number(item.price || 0),
      }));
      if (items.length) return items;
      return allowDemoFallback ? buildLocalAuctions() : [];
    } catch (error) {
      if (!allowDemoFallback) {
        window.alert(`Live auction listings fetch failed: ${error.message}`);
        return [];
      }
      return buildLocalAuctions();
    }
  };

  const getSession = (role) => (live.getSession ? live.getSession(role) : null);
  const getAdminSession = () => getSession("admin");
  const getBidderSession = () => getSession("seller") || getSession("customer") || null;
  const isAdminLoggedIn = () => Boolean(getAdminSession()?.token);

  const getLocalBids = () => readJson(LOCAL_BID_KEY, []);

  const loadSummary = async () => {
    summaryByPropertyId = new Map();
    const adminSession = getAdminSession();
    if (!live.request || !adminSession?.token) return;
    try {
      const response = await live.request("/sealed-bids/summary", { token: adminSession.token });
      const items = response?.items || [];
      summaryByPropertyId = new Map(
        items
          .filter((item) => item?.propertyId)
          .map((item) => [item.propertyId, item]),
      );
    } catch {
      summaryByPropertyId = new Map();
    }
  };

  const loadAdminBoard = async () => {
    adminBoardByPropertyId = new Map();
    const adminSession = getAdminSession();
    if (!live.request || !adminSession?.token) return;
    try {
      const response = await live.request("/sealed-bids/admin", { token: adminSession.token });
      const items = response?.items || [];
      adminBoardByPropertyId = new Map(
        items
          .filter((item) => item?.propertyId)
          .map((item) => [item.propertyId, item]),
      );
    } catch {
      adminBoardByPropertyId = new Map();
    }
  };

  const loadPublicWinners = async (candidateListings = []) => {
    winnerByPropertyId = new Map();
    if (!live.request) return;
    const revealTargets = [...new Set(
      (Array.isArray(candidateListings) ? candidateListings : [])
        .map((item) => String(item?.id || "").trim())
        .filter(Boolean),
    )];
    if (!revealTargets.length) return;
    await Promise.all(revealTargets.map(async (propertyId) => {
      try {
        const response = await live.request(`/sealed-bids/winner/${encodeURIComponent(propertyId)}`, {
          token: getAnyToken(),
        });
        if (response?.winner) winnerByPropertyId.set(propertyId, response.winner);
      } catch {
        // winner not available for this viewer
      }
    }));
  };

  const refreshData = async () => {
    const fetchedListings = await fetchLiveAuctions();
    listings = fetchedListings;
    await Promise.all([loadSummary(), loadAdminBoard()]);
    await loadPublicWinners(fetchedListings);
    renderAuctions();
  };

  const placeBid = async (propertyId) => {
    const bidderSession = getBidderSession();
    if (!bidderSession?.token) {
      window.alert("Bid place karne ke liye buyer ya seller login zaruri hai.");
      return;
    }
    const input = document.getElementById(`bidInput-${propertyId}`);
    const amount = Number(input?.value || 0);
    if (!amount || amount <= 0) {
      window.alert("Valid bid amount enter karein.");
      return;
    }

    let persistedOnServer = false;
    if (live.request) {
      try {
        await live.request("/sealed-bids", {
          method: "POST",
          token: bidderSession.token,
          data: { propertyId, amount },
        });
        persistedOnServer = true;
      } catch (error) {
        if (!live.shouldFallbackToLocal || !live.shouldFallbackToLocal(error)) {
          window.alert(error.message || "Bid submit failed.");
          return;
        }
      }
    }

    if (!persistedOnServer) {
      if (!allowDemoFallback) {
        window.alert("Live sealed bid submit failed. Please retry.");
        return;
      }
      const localBids = getLocalBids();
      localBids.push({
        propertyId,
        amount,
        bidder: (live.getAnySession ? live.getAnySession()?.name : "") || "LocalUser",
        bidderRole: bidderSession.role || "customer",
        publicVisible: false,
        createdAt: new Date().toISOString(),
      });
      writeJson(LOCAL_BID_KEY, localBids);
    }

    if (input) input.value = '';
    await refreshData();
    window.alert("Sealed bid placed successfully.");
  };

  const runAdminDecision = async (propertyId, action) => {
    const adminSession = getAdminSession();
    if (!adminSession?.token) {
      window.alert("Admin login required for sealed bid decisions.");
      return;
    }
    if (!live.request) {
      window.alert("Live API unavailable. Admin decision cannot be executed without backend connectivity.");
      return;
    }
    const decisionReason = String(window.prompt("Decision reason (minimum 12 characters):", "Security review completed and admin decision approved.") || "").trim();
    if (decisionReason.length < 12) {
      window.alert("Decision reason minimum 12 characters required.");
      return;
    }
    try {
      await live.request("/sealed-bids/decision", {
        method: "POST",
        token: adminSession.token,
        data: { propertyId, action, decisionReason },
      });
      await refreshData();
      window.alert(`Admin action '${action}' applied successfully.`);
    } catch (error) {
      window.alert(error.message || "Admin action failed.");
    }
  };

  const getStatusMarkup = (propertyId) => {
    const summary = summaryByPropertyId.get(propertyId);
    const adminBoard = adminBoardByPropertyId.get(propertyId);
    const isAdminView = isAdminLoggedIn();
    const totalBids = Number(adminBoard?.totalBids ?? summary?.totalBids ?? 0);
    const status = adminBoard?.status || summary?.status || "Hidden";
    const winner = winnerByPropertyId.get(propertyId);

    const parts = [];
    if (isAdminView) {
      parts.push(`<p><b>Total Bids:</b> ${totalBids}</p>`);
      parts.push(`<p><b>Status:</b> ${escapeHtml(status)}</p>`);
    }
    parts.push("<p><b>Visibility:</b> Bid amounts and bid list are hidden for buyer/seller/owner. Only admin can view all bids.</p>");

    const winnerAmount = Number(winner?.amount ?? winner?.winnerBidAmount ?? 0);
    const winnerName = winner?.bidderName || winner?.winnerBidder || "Bidder";
    if (winnerAmount > 0) {
      parts.push(
        `<p><b>Revealed Winner:</b> ${escapeHtml(winnerName)} at ${formatPrice(winnerAmount)}</p>`,
      );
    }
    return parts.join("");
  };

  const getAdminControlsMarkup = (propertyId) => {
    if (!isAdminLoggedIn()) return "<p><b>Admin Panel:</b> Login as admin to manage sealed bids.</p>";
    const board = adminBoardByPropertyId.get(propertyId);
    if (!board?.totalBids) return "<p><b>Admin Panel:</b> No bids available for decision.</p>";
    const topBid = board?.winnerBid?.amount ? formatPrice(board.winnerBid.amount) : "N/A";
    return `
      <div class="sealed-admin-panel">
        <p><b>Admin Panel:</b> Top bid ${topBid} | Total ${Number(board.totalBids || 0)}</p>
        <button type="button" data-admin-action="accept" data-admin-property="${propertyId}">Accept Highest</button>
        <button type="button" data-admin-action="reject" data-admin-property="${propertyId}">Reject All</button>
        <button type="button" data-admin-action="reveal" data-admin-property="${propertyId}">Reveal Winner</button>
      </div>
    `;
  };

  const renderAuctions = () => {
    if (!listings.length) {
      auctionDiv.innerHTML = "<p>No live auction-ready properties available right now.</p>";
      return;
    }
    const bidderSession = getBidderSession();
    const isBidAllowed = Boolean(bidderSession?.token);
    auctionDiv.innerHTML = listings.map((item) => `
      <div class="auction-card">
        <h3>${escapeHtml(item.title)}</h3>
        <p><b>Location:</b> ${escapeHtml(item.location)}, Udaipur</p>
        <p><b>Price:</b> ${formatPrice(item.price)}</p>
        <div class="sealed-summary">${getStatusMarkup(item.id)}</div>
        <input type="number" placeholder="Enter sealed bid amount" id="bidInput-${item.id}" />
        <button type="button" data-bid-property="${item.id}" ${isBidAllowed ? "" : "disabled"}>Place Sealed Bid</button>
        ${isBidAllowed ? "" : "<p><small>Buyer/Seller login required for bidding.</small></p>"}
        ${getAdminControlsMarkup(item.id)}
      </div>
    `).join('');
  };

  auctionDiv.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const propertyId = target.getAttribute("data-bid-property");
    if (propertyId) {
      placeBid(propertyId);
      return;
    }
    const adminAction = target.getAttribute("data-admin-action");
    const adminPropertyId = target.getAttribute("data-admin-property");
    if (adminAction && adminPropertyId) {
      runAdminDecision(adminPropertyId, adminAction);
    }
  });

  refreshData();
})();
