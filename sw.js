// Public-safe service worker.
// v2 MIGRATION: activate deletes EVERY cache except the current one — this
// purges 'gan-dash-v1', which (on previously installed clients) may hold old
// pages and research assets. Only the allowlisted shell below is ever cached;
// public-data.json and everything else are network-only and never stored.
"use strict";
const CACHE = "dash-safe-v2";
const SHELL = [
  "./", "./index.html", "./structures.html", "./style.css", "./app.js",
  "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png",
  "./icons/apple-touch-icon.png", "./icons/favicon-32.png",
];
const SHELL_SET = new Set(SHELL.map(p => new URL(p, self.location).pathname));

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // never touch cross-origin
  const cacheable = SHELL_SET.has(url.pathname);
  e.respondWith(
    fetch(e.request)
      .then(r => {
        if (cacheable && r.ok) {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        }
        return r;
      })
      .catch(() => cacheable
        ? caches.match(e.request)
        : Response.error())
  );
});
