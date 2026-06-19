// ============================================================
// EventPass: src/utils/router.js
// Hash-based SPA router with middleware support
// ============================================================

export class Router {
  constructor() {
    this._routes = new Map();
    this._middlewares = [];
    this._notFoundHandler = null;
    this._currentRoute = null;
    this._params = {};

    window.addEventListener('hashchange', () => this._handleRouteChange());
    // Do NOT auto-fire on 'load' — app calls init() after DOM shell is ready
  }

  /** Called once by the app after the shell DOM is in place. */
  init() {
    this._handleRouteChange();
  }

  /**
   * Register a route handler.
   * @param {string} path - e.g. '/events/:id/attendance'
   * @param {Function} handler - async (params, query) => void
   */
  on(path, handler) {
    this._routes.set(path, handler);
    return this;
  }

  /** Register a middleware (runs before every route) */
  use(middleware) {
    this._middlewares.push(middleware);
    return this;
  }

  /** Register 404 handler */
  notFound(handler) {
    this._notFoundHandler = handler;
    return this;
  }

  /** Navigate to a route programmatically */
  navigate(path) {
    window.location.hash = path;
  }

  /** Replace current route without adding to history */
  replace(path) {
    const url = window.location.href.split('#')[0] + '#' + path;
    window.history.replaceState(null, '', url);
    this._handleRouteChange();
  }

  /** Get current route path */
  getCurrentPath() {
    const hash = window.location.hash.slice(1) || '/';
    // Split by '#' first to handle trailing hash fragments like #access_token=
    const cleanHash = hash.split('#')[0];
    return cleanHash.split('?')[0];
  }

  /** Get current query params */
  getQueryParams() {
    const hash = window.location.hash.slice(1) || '/';
    const queryString = hash.split('?')[1] || '';
    return Object.fromEntries(new URLSearchParams(queryString));
  }

  /** Get current route params */
  getParams() {
    return { ...this._params };
  }

  async _handleRouteChange() {
    const rawPath = this.getCurrentPath();
    const query = this.getQueryParams();

    // Match route
    let matchedHandler = null;
    let params = {};

    for (const [pattern, handler] of this._routes) {
      const match = this._matchRoute(pattern, rawPath);
      if (match !== null) {
        matchedHandler = handler;
        params = match;
        break;
      }
    }

    this._params = params;
    this._currentRoute = rawPath;

    // Run middlewares
    for (const middleware of this._middlewares) {
      const shouldContinue = await middleware(rawPath, params, query);
      if (shouldContinue === false) return;
    }

    if (matchedHandler) {
      try {
        await matchedHandler(params, query);
      } catch (err) {
        console.error(`[Router] Error in route handler for "${rawPath}":`, err);
      }
    } else if (this._notFoundHandler) {
      this._notFoundHandler(rawPath);
    }
  }

  /**
   * Match a route pattern against a path.
   * Returns null if no match, or an object of params if match.
   */
  _matchRoute(pattern, path) {
    const patternParts = pattern.split('/').filter(Boolean);
    const pathParts = path.split('/').filter(Boolean);

    if (patternParts.length !== pathParts.length) return null;

    const params = {};

    for (let i = 0; i < patternParts.length; i++) {
      const pp = patternParts[i];
      const pp2 = pathParts[i];

      if (pp.startsWith(':')) {
        params[pp.slice(1)] = decodeURIComponent(pp2);
      } else if (pp !== pp2) {
        return null;
      }
    }

    return params;
  }
}

export default Router;
