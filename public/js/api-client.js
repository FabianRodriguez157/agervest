/**
 * Cliente API centralizado para AgerVest.
 * Toda la comunicación con el backend pasa por aquí. Las vistas no
 * construyen URLs manualmente.
 */
(function (global) {
  function base(path) {
    const prefix = (global.AGV_CONFIG && global.AGV_CONFIG.apiBase) || '';
    const normalized = path.startsWith('/') ? path : '/' + path;
    return prefix ? prefix.replace(/\/$/, '') + normalized : normalized;
  }

  async function request(method, path, body) {
    const prefix = (global.AGV_CONFIG && global.AGV_CONFIG.apiBase) || '';
    const token = global.localStorage && localStorage.getItem('agv_token');
    const headers = { 'Accept': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const opts = {
      method,
      credentials: prefix ? 'include' : 'same-origin',
      headers,
    };
    if (body !== undefined && body !== null) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const r = await fetch(base(path), opts);
    let data = null;
    const text = await r.text();
    if (text) { try { data = JSON.parse(text); } catch { data = { raw: text }; } }
    if (!r.ok) {
      const err = new Error((data && data.error) || `HTTP ${r.status}`);
      err.status = r.status;
      err.details = data && data.details;
      throw err;
    }
    return data;
  }

  const AgerVestAPI = {
    // ------------- Auth -------------
    async login(email, password, role)         { return request('POST', '/api/auth/login',           { email, password, role }); },
    async logout()                             { return request('POST', '/api/auth/logout'); },
    async me()                                 { return request('GET',  '/api/auth/me'); },
    async registerFarmer(payload)              { return request('POST', '/api/auth/register-farmer', payload); },
    async registerInvestor(payload)            { return request('POST', '/api/auth/register-investor', payload); },
    async registerAlly(payload)                { return request('POST', '/api/auth/register-ally',   payload); },
    async verifyInvestor(payload)              { return request('POST', '/api/auth/investor/verify', payload); },

    // ------------- Projects -------------
    async listProjects(filters = {}) {
      const q = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v) q.set(k, v); });
      const qs = q.toString();
      return request('GET', '/api/projects' + (qs ? '?' + qs : ''));
    },
    async getProject(id)                       { return request('GET',  `/api/projects/${id}`); },
    async createProject(payload)               { return request('POST', '/api/projects', payload); },
    async addProjectUpdate(id, payload)        { return request('POST', `/api/projects/${id}/updates`, payload); },

    // ------------- Farmers / dashboards -------------
    async getFarmer(id)                        { return request('GET', `/api/farmers/${id}`); },
    async getFarmerDashboard(id)               { return request('GET', `/api/farmers/${id}/dashboard`); },

    // ------------- Investors -------------
    async getInvestor(id)                      { return request('GET', `/api/investors/${id}`); },
    async getInvestorPortfolio(id)             { return request('GET', `/api/investors/${id}/portfolio`); },

    // ------------- Allies -------------
    async getAllyDashboard(id)                 { return request('GET', `/api/allies/${id}/dashboard`); },

    // ------------- Investments -------------
    async invest(projectId, amount)            { return request('POST', '/api/investments', { projectId, amount }); },

    // ------------- Wallet -------------
    async myTransactions()                     { return request('GET',  '/api/wallet/transactions'); },
    async myPendingReturns()                   { return request('GET',  '/api/wallet/pending-returns'); },
    async myPendingObligations()               { return request('GET',  '/api/wallet/pending-obligations'); },
    async payReturn(transactionId)             { return request('POST', '/api/wallet/pay-return', { transactionId }); },
    async processDueReturns()                  { return request('POST', '/api/wallet/process-due-returns'); },
    async settleProject(projectId)             { return request('POST', `/api/wallet/settle-project/${projectId}`); },

    // ------------- Stats -------------
    async stats()                              { return request('GET', '/api/stats'); },
  };

  global.AgerVestAPI = AgerVestAPI;
})(window);
